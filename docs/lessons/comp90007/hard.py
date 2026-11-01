# The hard-problem unit of the Internet Technologies demo course (README.md here): the classic calculations
# of the course that neither the review lectures' sample questions nor the practice exam ask, each taught
# through one practice problem the way the other two units teach an exam question. The problems are written
# for the course, in the style of the exam, with numbers from the lecture slides or standard textbook
# exercises (README.md lists them). build.py imports HARD_LESSONS and writes the unit.
import math

from build import *  # noqa: F401,F403  (T and the block helpers, Fig, drawn, skills, the colours, the chapter titles)
from practice import mixed, poly, bits  # noqa: F401

PP = lambda: T('A practice problem, in the style of the exam', '练习题 · 仿考试题型')
PPA = lambda: T('A full-mark answer', '满分答案')


def long_division(data, gen, pad=True):
    """Modulo-2 long division of data (with len(gen) - 1 zeros appended, unless `pad` is off: a received frame
    already carries its check bits) by gen, as aligned text: under each leading 1 the generator, then what is
    left after the XOR (leading zeros dropped), down to the remainder."""
    r = len(gen) - 1
    m = [int(c) for c in data + ('0' * r if pad else '')]
    data = data if pad else data[:-r]
    g = [int(c) for c in gen]
    lines = [''.join(map(str, m))]
    i = m.index(1) if 1 in m else None
    while i is not None and i < len(data):
        lines.append(' ' * i + gen)
        lines.append(' ' * i + '-' * (len(m) - i))
        for j in range(len(g)):
            m[i + j] ^= g[j]
        i = m.index(1) if 1 in m else None
        if i is None or i >= len(data):
            lines.append(' ' * (len(m) - r) + ''.join(map(str, m[-r:])))
        else:
            lines.append(' ' * i + ''.join(map(str, m[i:])))
    return '\n'.join(lines), ''.join(map(str, m[-r:]))


# ---------------------------------------------------------------- drawings
def fig_hamming(lang):
    """A 7-bit Hamming codeword: check bits at 1, 2 and 4, and which positions each one covers."""
    F = Fig(600, 236, lang)
    x0, w = 150, 60
    word = '1010101'
    for i in range(7):
        pos = i + 1
        check = pos in (1, 2, 4)
        x = x0 + w * i
        F.text(x + w / 2 - 2, 26, str(pos), 15, MUTED, 'middle')
        F.rect(x, 36, w - 4, 38, GOLD + '33' if check else '#ffffff', GOLD if check else MUTED, 1.6 if check else 1.2, rx=4)
        F.text(x + w / 2 - 2, 61, word[i], 18, INK, 'middle', '600' if check else None)
        F.text(x + w / 2 - 2, 94, f'p{pos}' if check else f'd{pos}', 14, GOLD if check else MUTED, 'middle', '600' if check else None)
    F.text(x0 - 16, 61, F.L('codeword', '码字'), 15, INK, 'end', '600')
    for k, (p, cover) in enumerate(((1, (1, 3, 5, 7)), (2, (2, 3, 6, 7)), (4, (4, 5, 6, 7)))):
        y = 126 + 36 * k
        F.text(x0 - 16, y + 18, F.L(f'p{p} checks', f'p{p} 校验'), 15, GOLD, 'end', '600')
        for i in range(7):
            pos = i + 1
            on = pos in cover
            x = x0 + w * i
            F.rect(x + 10, y + 4, w - 24, 22, GOLD + '55' if on else '#ffffff', GOLD if on else LINE, 1.2, rx=4)
            if on:
                F.text(x + w / 2 - 2, y + 20, str(pos), 13, INK, 'middle')
    return F.svg()


def fig_collision(lang):
    """Space against time on the cable: A's frame reaches B after τ; B starts just before; the noise is back at A at 2τ."""
    F = Fig(600, 330, lang)
    xa, xb, y0, y1 = 90, 520, 40, 300
    F.text(xa, 26, 'A', 18, INK, 'middle', '600')
    F.text(xb, 26, 'B', 18, INK, 'middle', '600')
    F.line(xa, y0, xa, y1, LINE, 2)
    F.line(xb, y0, xb, y1, LINE, 2)
    F.line(xa, y0, xb, 160, BLUE, 2.6, arrow=True)
    F.text(240, 82, F.L("A's frame", 'A 的帧'), 15, BLUE, 'middle', '600')
    F.line(xb, 154, xb - 30, 166, ORANGE, 2.4)
    F.cross(xb - 8, 160, 7)
    F.line(xb, 158, xa, 278, ORANGE, 2.6, '6 5', arrow=True)
    F.text(380, 246, F.L('collision noise', '冲突的噪声'), 15, ORANGE, 'middle', '600')
    for y, lab in ((y0, '0'), (160, 'τ'), (278, '2τ')):
        F.line(xa - 8, y, xa - 30, y, MUTED, 1.2)
        F.text(xa - 36, y + 5, lab, 16, INK, 'end', '600' if lab == '2τ' else None)
    F.rect(xa - 6, y0, 12, 238, BLUE_SOFT, BLUE, 1.4, rx=3)
    F.text(xa + 14, 316, F.L('A must still be sending at 2τ', 'A 到 2τ 时必须还在发'), 15, BLUE, 'start', '600')
    F.text(xb + 10, 150, F.L('B starts', 'B 开始发'), 14, ORANGE)
    F.text(560, 316, F.L('time ↓', '时间 ↓'), 14, MUTED, 'end')
    return F.svg()


def fig_fragments(lang):
    """A 4000-byte datagram (20-byte header, 3980 bytes of data) cut into three fragments for an MTU of 1500."""
    F = Fig(600, 248, lang)
    x0, scale = 40, 520 / 4000
    F.text(x0, 28, F.L('the datagram · 4000 bytes', '原数据报 · 4000 字节'), 16, INK, weight='600')
    F.rect(x0, 40, 20 * scale * 4, 34, GREY_SOFT, INK, 1.4, rx=3)
    F.text(x0 + 40 * scale * 2 / 2, 62, 'H', 14, INK, 'middle')
    F.rect(x0 + 80 * scale, 40, 3980 * scale, 34, '#ffffff', INK, 1.4, rx=3)
    F.text(x0 + 80 * scale + 3980 * scale / 2, 62, F.L('data · 3980', '数据 · 3980'), 15, INK, 'middle')
    cols = (BLUE, PURPLE, GREEN)
    starts = (0, 1480, 2960)
    sizes = (1480, 1480, 1020)
    for k, (st, sz) in enumerate(zip(starts, sizes)):
        x = x0 + 80 * scale + st * scale
        F.rect(x, 82, sz * scale, 8, cols[k], None, rx=2)
    F.text(x0, 126, F.L('fragments · MTU 1500', '分片 · MTU 1500'), 16, INK, weight='600')
    for k, (st, sz) in enumerate(zip(starts, sizes)):
        y = 140 + 34 * k
        x = x0 + 80 * scale + st * scale
        F.rect(x - 80 * scale, y, 80 * scale, 26, GREY_SOFT, INK, 1.2, rx=3)
        F.rect(x, y, sz * scale, 26, '#ffffff', cols[k], 1.8, rx=3)
        F.text(x + sz * scale / 2, y + 18, f'{sz}', 14, cols[k], 'middle', '600')
        lab = F.L(f'offset {st // 8}, MF {1 if k < 2 else 0}', f'偏移 {st // 8}，MF {1 if k < 2 else 0}')
        if k < 2:
            F.text(x + sz * scale + 8, y + 18, lab, 14, INK)
        else:
            F.text(x - 80 * scale - 8, y + 18, lab, 14, INK, 'end')
    return F.svg()


def fig_cidr(lang):
    """198.16.0.0 to 198.16.95.255 as a line: A, B, C and D each on a boundary that is a multiple of its size, leaving two gaps."""
    F = Fig(600, 196, lang)
    x0, w = 30, 540 / 96
    blocks = (('A', 0, 16, BLUE), ('B', 16, 8, PURPLE), ('', 24, 8, None), ('C', 32, 16, GREEN), ('', 48, 16, None), ('D', 64, 32, GOLD))
    for name, st, sz, col in blocks:
        x = x0 + st * w
        if col:
            F.rect(x, 50, sz * w - 2, 46, col + '22', col, 1.8, rx=4)
            F.text(x + sz * w / 2, 72, name, 18, col, 'middle', '600')
            F.text(x + sz * w / 2, 90, f'/{32 - int(math.log2(sz * 256))}', 14, col, 'middle')
        else:
            F.rect(x, 50, sz * w - 2, 46, '#ffffff', LINE, 1.2, rx=4, dash='4 4')
            F.text(x + sz * w / 2, 78, F.L('free', '空'), 14, MUTED, 'middle')
    for t in (0, 16, 24, 32, 48, 64, 96):
        x = x0 + t * w
        F.line(x, 100, x, 112, MUTED, 1.2)
        F.text(x, 130, str(t), 14, INK, 'middle')
    F.text(x0, 30, '198.16.x.0', 15, MUTED)
    F.text(300, 162, F.L('third byte of the address', '地址的第三个字节'), 14, MUTED, 'middle')
    return F.svg()


DJ_POS = {'A': (50, 150), 'B': (180, 50), 'C': (400, 50), 'D': (550, 150), 'E': (220, 150), 'F': (380, 150), 'G': (180, 250), 'H': (400, 250)}
DJ_EDGES = (('A', 'B', 2), ('A', 'G', 6), ('B', 'C', 7), ('B', 'E', 2), ('E', 'G', 1), ('E', 'F', 2), ('F', 'C', 3), ('C', 'D', 3), ('F', 'H', 2), ('G', 'H', 4), ('H', 'D', 2))


def dijkstra(src='A'):
    """Every step of Dijkstra's algorithm: (node made permanent, its distance, its predecessor, the tentative labels then)."""
    adj = {}
    for a, b, c in DJ_EDGES:
        adj.setdefault(a, []).append((b, c))
        adj.setdefault(b, []).append((a, c))
    dist, prev, done, steps = {src: 0}, {src: None}, [], []
    while len(done) < len(DJ_POS):
        n = min((x for x in dist if x not in done), key=lambda x: (dist[x], x))
        done.append(n)
        for m, c in adj[n]:
            if m not in done and dist[n] + c < dist.get(m, math.inf):
                dist[m], prev[m] = dist[n] + c, n
        steps.append((n, dist[n], prev[n], {x: (dist[x], prev[x]) for x in dist if x not in done}))
    return steps


def fig_dijkstra(lang, path=False):
    """The eight-router network of the problem; with `path`, the shortest path from A to D."""
    F = Fig(600, 300, lang)
    on = {('A', 'B'), ('B', 'E'), ('E', 'F'), ('F', 'H'), ('H', 'D')} if path else set()
    for a, b, c in DJ_EDGES:
        hot = (a, b) in on or (b, a) in on
        (x1, y1), (x2, y2) = DJ_POS[a], DJ_POS[b]
        F.line(x1, y1, x2, y2, GREEN if hot else INK, 4 if hot else 1.6)
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        F.circle(mx, my, 11, '#ffffff', None)
        F.text(mx, my + 5, str(c), 15, GREEN if hot else BLUE, 'middle', '600')
    for n, (x, y) in DJ_POS.items():
        F.circle(x, y, 18, GREEN_SOFT if (path and n in 'ABEFHD') else '#ffffff', GREEN if (path and n in 'ABEFHD') else INK, 1.8)
        F.text(x, y + 6, n, 16, INK, 'middle', '600')
    return F.svg()


def fig_pipe(lang):
    """One round of stop-and-wait on the satellite link: 1 ms of sending, 540 ms of waiting."""
    F = Fig(600, 136, lang)
    x0, total = 30, 540
    F.text(x0, 28, F.L('one round · 541 ms', '一轮 · 541 ms'), 16, INK, weight='600')
    F.rect(x0, 42, total, 36, GREY_SOFT, MUTED, 1.2, rx=4)
    F.rect(x0, 42, max(2.5, total / 541), 36, BLUE, None, rx=1)
    F.line(x0 + 1, 92, x0 + 1, 104, BLUE, 1.6)
    F.text(x0, 122, F.L('1 ms sending', '发送 1 ms'), 15, BLUE, weight='600')
    F.text(x0 + total, 122, F.L('540 ms waiting for the ACK', '等确认 540 ms'), 15, MUTED, 'end')
    return F.svg()


def fig_dh(lang, trudy=False):
    """Diffie–Hellman with n = 23, g = 5: each side sends g to its secret power; both reach the same key."""
    F = Fig(600, 236 if not trudy else 262, lang)
    if not trudy:
        X = {'A': 80, 'B': 520}
        for k, name, secret in (('A', 'Alice', 'x = 6'), ('B', 'Bob', 'y = 15')):
            F.rect(X[k] - 60, 10, 120, 34, GREY_SOFT, INK, 1.6)
            F.text(X[k], 33, name, 17, INK, 'middle', '600')
            F.text(X[k], 64, F.L('secret ', '秘密 ') + secret, 15, ORANGE, 'middle', '600')
            F.line(X[k], 74, X[k], 210, LINE, 1.8)
        F.line(84, 104, 516, 104, BLUE, 2.2, arrow=True)
        F.text(300, 96, '5^{6} mod 23 = 8', 16, BLUE, 'middle', '600')
        F.line(516, 150, 84, 150, PURPLE, 2.2, arrow=True)
        F.text(300, 142, '5^{15} mod 23 = 19', 16, PURPLE, 'middle', '600')
        F.rect(20, 176, 120, 34, GREEN_SOFT, GREEN, 1.6)
        F.text(80, 198, '19^{6} mod 23 = 2', 14, GREEN, 'middle', '600')
        F.rect(460, 176, 120, 34, GREEN_SOFT, GREEN, 1.6)
        F.text(520, 198, '8^{15} mod 23 = 2', 14, GREEN, 'middle', '600')
        F.text(300, 228, F.L('the same key, never sent', '同一把密钥，从没发出去过'), 15, GREEN, 'middle', '600')
    else:
        X = {'A': 70, 'T': 300, 'B': 530}
        for k, name in (('A', 'Alice'), ('T', 'Trudy'), ('B', 'Bob')):
            F.rect(X[k] - 56, 10, 112, 34, RED_SOFT if k == 'T' else GREY_SOFT, ORANGE if k == 'T' else INK, 1.6)
            F.text(X[k], 33, name, 17, ORANGE if k == 'T' else INK, 'middle', '600')
            F.line(X[k], 44, X[k], 200, LINE, 1.8)
        F.line(74, 76, 294, 76, INK, 2, arrow=True)
        F.text(184, 68, 'g^{x}', 15, INK, 'middle')
        F.line(306, 76, 524, 76, ORANGE, 2, arrow=True)
        F.text(414, 68, 'g^{z}', 15, ORANGE, 'middle', '600')
        F.line(524, 124, 306, 124, INK, 2, arrow=True)
        F.text(414, 116, 'g^{y}', 15, INK, 'middle')
        F.line(294, 124, 74, 124, ORANGE, 2, arrow=True)
        F.text(184, 116, 'g^{z}', 15, ORANGE, 'middle', '600')
        F.rect(10, 152, 160, 34, GREEN_SOFT, GREEN, 1.4)
        F.text(90, 174, F.L('key with Trudy', '和 Trudy 的密钥'), 14, GREEN, 'middle', '600')
        F.rect(440, 152, 160, 34, GREEN_SOFT, GREEN, 1.4)
        F.text(520, 174, F.L('key with Trudy', '和 Trudy 的密钥'), 14, GREEN, 'middle', '600')
        F.rect(220, 152, 160, 34, RED_SOFT, ORANGE, 1.4)
        F.text(300, 174, F.L('holds both keys', '两把密钥都在手'), 14, ORANGE, 'middle', '600')
        F.text(300, 240, F.L('every number is computed mod n', '所有数都对 n 取模'), 14, MUTED, 'middle')
    return F.svg()


# ---------------------------------------------------------------- the lessons
# Each lesson follows the other units: the problem as printed and a slow read; the ideas from the ground up;
# the working, line by line, with one line left to the learner; a full-mark answer; the wider topic; practice.
def L_hard_start():
    return dict(
        id=f'{CID}-hard-start', title=T('Start here: the classic hard problems', '从这里开始：常考的难题'),
        description=T('The calculations every part of the course practises that neither the sample questions nor the practice exam ask, one problem for each, and how to set out a calculation for full marks.', '课程各部分都练过、而样题和模拟卷都没考到的计算题，每类一道例题，以及计算题怎样写才拿满分。'),
        minutes=8,
        skills=[{'id': 'it-hard.map', 'name': T('The classic calculations', '经典计算题')}],
        steps=[
            read('problems', T('The problems, one of each kind', '每类一道题'),
                 p(T(r"The review lectures' sample questions and the practice exam leave out several calculations that the lecture slides work through, and that textbook exercises on this material ask again and again. Each has a lesson here, built around one problem written in the style of the exam.",
                     r"复习课的样题和模拟卷，漏掉了好几类课件里专门演算过、教材习题里也反复出现的计算。这里每类一课，每课围绕一道仿照考试风格写的题。")),
                 table([T('Problem', '题型'), T('The example', '例题'), T('Lesson', '在哪一课')],
                       [T('CRC', 'CRC'), T('The frame sent for data 10011101 with generator $x^3 + 1$, and whether a flipped bit is caught.', '数据 10011101、生成多项式 $x^3 + 1$ 时发出的帧，以及翻转一位能否被发现。'), T('Computing the check bits', '算校验位')],
                       [T('Hamming code', '汉明码'), T('The codeword for 1101, and which bit of 1010111 is wrong.', '1101 的码字，以及 1010111 错在哪一位。'), T('Computing the check bits', '算校验位')],
                       [T('Minimum frame size', '最小帧长'), T('CSMA/CD at 1 Gbps over 1 km: the shortest frame that still detects collisions.', '1 Gbps、1 公里的 CSMA/CD：还能检测到冲突的最短帧。'), T("Ethernet's shortest frame", '以太网的最短帧')],
                       [T('Fragmentation', '分片'), T('A 4000-byte datagram through an MTU of 1500: lengths, offsets, MF flags.', '4000 字节的数据报经过 MTU 1500 的链路：长度、偏移、MF 标志。'), T('Fragmenting a datagram', '数据报分片')],
                       [T('CIDR', 'CIDR'), T('Address blocks for four organisations from 198.16.0.0; four /21s aggregated.', '从 198.16.0.0 起给四个机构分地址块；把四个 /21 聚合。'), T('Handing out address blocks', '分配地址块')],
                       [T('Dijkstra', 'Dijkstra'), T('The shortest path from A to D in an eight-router network.', '一个八台路由器的网络里，A 到 D 的最短路径。'), T('Shortest paths by hand', '手算最短路径')],
                       [T('Windows on a long link', '长链路上的窗口'), T('Stop-and-wait and a window of 7 over a satellite; the window and sequence numbers that fill it.', '卫星链路上的停等协议和 7 帧窗口；填满链路要多大的窗口、几位序号。'), T('A window over a satellite', '卫星链路上的窗口')],
                       [T('RSA and Diffie–Hellman', 'RSA 和 Diffie–Hellman'), T('Keys, encryption and a signature with p = 3, q = 11; a shared key with n = 23, g = 5.', 'p = 3、q = 11 时的密钥、加密和签名；n = 23、g = 5 时的共享密钥。'), T('Public-key arithmetic', '公钥的算术')]),
                 p(T(r"The problems are written for this course; their numbers come from the lecture slides' own examples or from standard textbook exercises.", r"这些题是为本课程写的；数字取自课件里的例子，或标准教材的习题。"))),
            read('method', T('How to set out a calculation', '计算题怎么写'),
                 ol(T(r"**Name the rule** before using it: *the frame must last at least $2\tau$*; *a /s block starts at a multiple of its size*.", r"**先写规则**再用它：*帧的持续时间至少要 $2\tau$*；*/s 的块必须从它大小的整数倍开始*。"),
                    T(r"**One step per line**, with the numbers put in and the units kept: µs, bits, bytes.", r"**一行一步**，代入数字，带上单位：µs、位、字节。"),
                    T(r"**Say what the result means**: *so the minimum frame is 1250 bytes*; *so bit 6 is wrong*.", r"**说清结果的意思**：*所以最小帧长是 1250 字节*；*所以第 6 位错了*。"),
                    T(r"**Check it** when a check is cheap: divide the CRC frame again; decrypt what you encrypted.", r"**能验算就验算**，只要不费事：把 CRC 的帧再除一遍；把加密的结果再解密回来。"))),
            read('how', T('How each lesson works', '每一课怎么走'),
                 p(T(r"Each lesson works like the exam units: the problem as printed and a slow read of it; the ideas it needs, from the ground up; the working, one line at a time, with one line left to you; the answer written out for full marks; the wider topic; and new problems.",
                     r"每一课的走法和前两个单元一样：题目原文，慢慢读一遍；从头讲需要的想法；一行一行写出过程，留一行给你；按满分标准写出答案；这类题的全貌；再做几道新题。")),
                 callout('note', T('The exam is in English', '考试是英文的'),
                         T(r"Every full-mark answer is in English, so you can write in the words the examiner expects.", r"满分答案都用英文写，方便你直接用阅卷人熟悉的词作答。"))),
        ],
    )


CRC_DATA, CRC_GEN = '10011101', '1001'
CRC_SENT = CRC_DATA + long_division(CRC_DATA, CRC_GEN)[1]
CRC_BAD = CRC_SENT[:2] + str(1 - int(CRC_SENT[2])) + CRC_SENT[3:]


def L_hard_codes():
    CR, HC, CS, ED = 'hm4t5u.crc', 'hm4t5u.hamming-code', 'hm4t5u.internet-checksum', 'hm4t5u.error-control'
    P1, P2 = T('Problem 1: a CRC', '题 1：CRC'), T('Problem 2: a Hamming code', '题 2：汉明码')
    div_a, rem_a = long_division(CRC_DATA, CRC_GEN)
    div_b, rem_b = long_division(CRC_BAD, CRC_GEN, pad=False)
    try_data, try_gen = '110101', '101'
    try_rem = long_division(try_data, try_gen)[1]
    return dict(
        id=f'{CID}-hard-codes', title=T('Computing the check bits: a CRC and a Hamming code', '算校验位：CRC 和汉明码'),
        description=T('Modulo-2 long division for a CRC and the check at the receiver; placing and checking the bits of a Hamming code, and finding the wrong bit; the Internet checksum.', 'CRC 的模 2 长除法和接收方的检验；汉明码校验位的放置与检查，以及找出错的那一位；互联网校验和。'),
        minutes=40,
        skills=skills(CR, HC, CS, ED),
        misconceptions=[{'id': 'crc-normal-subtract', 'description': T('Subtracting with borrows in a CRC instead of XOR', '算 CRC 时用了带借位的减法，而不是异或')},
                        {'id': 'hamming-data-positions', 'description': T('Putting the data bits in positions 1 to 4 instead of 3, 5, 6, 7', '把数据位放在第 1 到 4 位，而不是第 3、5、6、7 位')}],
        steps=[
            read('p1', T('Problem 1, as printed', '题 1 原文'),
                 paper(PP(), T(r"A bit stream 10011101 is transmitted using the standard CRC method. The generator polynomial is $x^3 + 1$.", r"用标准的 CRC 方法传送位串 10011101。生成多项式为 $x^3 + 1$。"),
                       T(r"(a) Show the actual bit string transmitted.", r"(a) 写出实际发送的位串。"),
                       T(r"(b) Suppose the third bit from the left is inverted during transmission. Show that this error is detected at the receiver's end.", r"(b) 假设从左数第三位在传输中被翻转。说明接收方能检测到这个错误。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**The generator polynomial** $x^3 + 1$ stands for a bit string: one bit per power of $x$, from $x^3$ down to $x^0$. $x^3 + 1$ is $1x^3 + 0x^2 + 0x + 1$, so **1001**. Its degree, 3, is the number of check bits.", r"**生成多项式** $x^3 + 1$ 代表一个位串：$x$ 的每个幂次一位，从 $x^3$ 到 $x^0$。$x^3 + 1$ 就是 $1x^3 + 0x^2 + 0x + 1$，即 **1001**。它的次数 3 就是校验位的位数。"),
                    T(r"**The standard CRC method**: the four steps on the course's slide, built below.", r"**标准的 CRC 方法**：课件上的四个步骤，下面从头讲。"),
                    T(r"**(b)**: the receiver gets the string with one bit flipped, and does its own check. *Show* means doing that check.", r"**(b)**：接收方收到的位串翻了一位，它要做自己的检验。*说明*就是把这个检验做出来。")),
                 chapter=P1),
            read('crc', T('Dividing without carries', '不进位的除法'),
                 p(T(r"A CRC treats the bits as the coefficients of a polynomial and does arithmetic **modulo 2**: no carries and no borrows, so adding and subtracting are both XOR ($1 + 1 = 0$, $0 - 1 = 1$). Long division works as at school, except that each subtraction is an XOR, and the generator goes under the next leading 1.",
                     r"CRC 把位看成一个多项式的系数，按**模 2** 做算术：不进位也不借位，所以加和减都是异或（$1 + 1 = 0$，$0 - 1 = 1$）。长除法和小学学的一样，只是每次相减都换成异或，除数总是对齐到下一个打头的 1 下面。")),
                 p(T(r"The course's four steps, with $r$ the degree of the generator $G(x)$:", r"课件上的四步，$r$ 是生成多项式 $G(x)$ 的次数：")),
                 ol(T(r"Append $r$ zeros to the data.", r"在数据后面补 $r$ 个 0。"),
                    T(r"Divide the result by the generator, modulo 2.", r"用生成多项式去除，模 2。"),
                    T(r"Subtract the remainder ($r$ bits) from the padded data: it simply replaces the $r$ zeros.", r"从补 0 后的数据里减去余数（$r$ 位）：其实就是用余数替换那 $r$ 个 0。"),
                    T(r"Send the result. It is exactly divisible by the generator.", r"把结果发出去。它正好能被生成多项式整除。")),
                 p(T(r"The receiver divides everything it receives by the same generator. A remainder of 0 means no error was seen; anything else means the frame is damaged. An error slips through only if the pattern of flipped bits is itself a multiple of the generator.",
                     r"接收方用同一个生成多项式去除收到的全部位。余数为 0，说明没看出错误；不为 0，说明帧坏了。只有翻转的那些位组成的图样本身恰好是生成多项式的倍数时，错误才会漏过去。"))),
            derive('p1-a', T('Part (a), worked', '第 (a) 问：完整解法'),
                   [(r'x^3 + 1 \;\leftrightarrow\; 1001,\qquad r = 3', T(r"The generator as bits; degree 3, so 3 check bits.", r"生成多项式写成位串；次数 3，所以 3 个校验位。")),
                    (rf'{CRC_DATA} \;\to\; {CRC_DATA}\,000', T(r"Append 3 zeros.", r"补 3 个 0。")),
                    (rf'{CRC_DATA}\,000 \bmod 1001 = {rem_a}', T(r"Divide by 1001, modulo 2. The long division is on the next page.", r"用 1001 去除，模 2。长除法过程在下一页。")),
                    (rf'{CRC_SENT[:8]}\,{CRC_SENT[8:]}', T(r"The remainder replaces the three zeros: this is the string sent.", r"余数替换掉三个 0：这就是发出的位串。"))],
                   blank=(2, rem_a, T(r"Divide 10011101000 by 1001, modulo 2. What is the 3-bit remainder? (Type it as digits, such as 011.)", r"用 1001 去除 10011101000，模 2。3 位余数是多少？（按数字输入，比如 011。）")),
                   skill=CR),
            read('p1-division', T('The long division, and the check at the receiver', '长除法，以及接收方的检验'),
                 {'type': 'code', 'lang': 'text', 'code': div_a, 'caption': T(f'(a) 10011101 with three zeros appended, divided by 1001. Each line under a 1001 is the XOR; leading zeros are dropped. The remainder is {rem_a}.', f'(a) 10011101 补三个 0 后除以 1001。每个 1001 下面一行是异或的结果，打头的 0 省去。余数是 {rem_a}。')},
                 p(T(r"Part (b): the third bit from the left is inverted, so the receiver gets a different string. It divides the whole of it by 1001, with no zeros appended: the check bits are already there.",
                     r"第 (b) 问：从左数第三位被翻转，接收方收到的是另一个位串。它用 1001 去除收到的全部位，不再补 0：校验位已经在里面了。")),
                 {'type': 'code', 'lang': 'text', 'code': div_b, 'caption': T(f'(b) The received {CRC_BAD} divided by 1001. The remainder is {rem_b}, not 000.', f'(b) 收到的 {CRC_BAD} 除以 1001。余数是 {rem_b}，不是 000。')},
                 p(T(rf"The remainder is {rem_b}, not 0, so the receiver knows the frame is damaged and discards it. (Dividing the correct string {CRC_SENT} leaves 000.)",
                     rf"余数是 {rem_b}，不是 0，所以接收方知道这一帧坏了，把它丢掉。（用正确的位串 {CRC_SENT} 去除，余数是 000。）"))),
            read('p1-answer', T('Problem 1: a full-mark answer', '题 1：满分答案'),
                 p(T(r"The generator as bits, the zeros appended, the division shown, the remainder in place; for (b), the received string, its division, and the conclusion from the remainder.", r"生成多项式写成位串、补 0、写出除法、余数就位；(b) 写出收到的位串、它的除法，以及由余数得出的结论。")),
                 paper(PPA(),
                       T(rf"(a) $G(x) = x^3 + 1$ is 1001, of degree 3, so three zeros are appended: {CRC_DATA}000. Dividing by 1001 modulo 2 (long division shown) leaves the remainder {rem_a}, which replaces the zeros. The string transmitted is {CRC_SENT}.",
                         rf"(a) $G(x) = x^3 + 1$ 即 1001，次数为 3，所以补三个 0：{CRC_DATA}000。用 1001 做模 2 除法（写出长除法过程），余数为 {rem_a}，用它替换三个 0。实际发送的位串是 {CRC_SENT}。"),
                       T(rf"(b) With the third bit inverted, the receiver gets {CRC_BAD}. Dividing it by 1001 modulo 2 leaves the remainder {rem_b}, which is not zero, so the error is detected.",
                         rf"(b) 第三位翻转后，接收方收到 {CRC_BAD}。用 1001 做模 2 除法，余数为 {rem_b}，不为零，所以能检测到这个错误。"),
                       answer=True)),
            read('p2', T('Problem 2, as printed', '题 2 原文'),
                 paper(PP(), T(r"The data bits 1101 are sent using a Hamming code with even parity, with the check bits in positions 1, 2 and 4.", r"用偶校验的汉明码发送数据位 1101，校验位放在第 1、2、4 位。"),
                       T(r"(a) What codeword is sent?", r"(a) 发出的码字是什么？"),
                       T(r"(b) The receiver gets 1010111. Which bit is in error, and what data was sent?", r"(b) 接收方收到 1010111。哪一位出错了？发送的数据是什么？")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**Positions** are numbered from the left, starting at 1. A codeword here has 7 positions: 3 check bits and 4 data bits.", r"**位置**从左往右编号，从 1 开始。这里一个码字有 7 位：3 个校验位、4 个数据位。"),
                    T(r"**Check bits in positions 1, 2 and 4**, the powers of 2. The data bits fill the other positions, 3, 5, 6 and 7, in order.", r"**校验位在第 1、2、4 位**，也就是 2 的幂次。数据位按顺序填进其余的位置：3、5、6、7。"),
                    T(r"**Even parity**: each check bit is chosen so that its group of positions holds an even number of 1s.", r"**偶校验**：每个校验位的取值，要让它负责的那组位置里 1 的个数为偶数。")),
                 chapter=P2),
            read('hamming', T('Which bits each check covers', '每个校验位管哪几位'),
                 p(T(r"A Hamming code adds enough check bits to *locate* a single error, not just see it. With $k$ check bits there are $2^k$ patterns of passed and failed checks; one must mean *no error*, and each of the $n + k$ positions needs its own. The course's rule follows: $2^k - k - 1 \ge n$. For 4 data bits, $k = 3$ ($8 - 3 - 1 = 4$).",
                     r"汉明码加的校验位要足以*定位*一个错，而不只是看出有错。$k$ 个校验位有 $2^k$ 种通过/不通过的组合；其中一种要表示“没有错”，$n + k$ 个位置又各要一种。于是有课上的规则：$2^k - k - 1 \ge n$。4 个数据位时 $k = 3$（$8 - 3 - 1 = 4$）。")),
                 p(T(r"The check bits sit at the powers of 2, positions 1, 2 and 4. Write each position in binary: check $p$ covers every position whose number contains $p$. Check 1 covers 1, 3, 5, 7 (binary ending in 1); check 2 covers 2, 3, 6, 7; check 4 covers 4, 5, 6, 7.",
                     r"校验位放在 2 的幂次上：第 1、2、4 位。把每个位置写成二进制：校验位 $p$ 管所有位置编号里含 $p$ 的位置。校验 1 管 1、3、5、7（二进制末位是 1）；校验 2 管 2、3、6、7；校验 4 管 4、5、6、7。")),
                 svg(drawn(fig_hamming), T('A 7-bit codeword 1010101 with positions 1 to 7; check bits p1, p2, p4 at positions 1, 2, 4 and data bits d3, d5, d6, d7. Below, the positions each check covers: p1 covers 1, 3, 5, 7; p2 covers 2, 3, 6, 7; p4 covers 4, 5, 6, 7.',
                                           '7 位码字 1010101，位置 1 到 7；校验位 p1、p2、p4 在第 1、2、4 位，数据位 d3、d5、d6、d7。下方是每个校验位覆盖的位置：p1 管 1、3、5、7；p2 管 2、3、6、7；p4 管 4、5、6、7。'),
                     T(r"The problem's codeword, 1010101. Every position is covered by a different set of checks, which is what lets the failed checks name the wrong bit.", r"题目里的码字 1010101。每个位置被覆盖的那组校验各不相同，正因如此，不通过的校验才能指认出错的那一位。")),
                 p(T(r"So if one bit flips, exactly the checks that cover it fail, and **the failed checks add up to its position**: position 6 is $2 + 4$, so a flip there fails checks 2 and 4 only.",
                     r"所以一位翻转时，恰好是覆盖它的那些校验不通过，**不通过的校验加起来就是它的位置**：第 6 位是 $2 + 4$，所以它翻转时只有校验 2 和 4 不通过。"))),
            derive('p2-a', T('Part (a): the codeword', '第 (a) 问：码字'),
                   [(r'd_3\,d_5\,d_6\,d_7 = 1\;1\;0\;1', T(r"The data bits 1101 go into positions 3, 5, 6 and 7.", r"数据位 1101 依次放进第 3、5、6、7 位。")),
                    (r'p_1 = d_3 \oplus d_5 \oplus d_7 = 1 \oplus 1 \oplus 1 = 1', T(r"$p_1$ makes positions 1, 3, 5, 7 even ($\oplus$ is XOR: the sum modulo 2).", r"$p_1$ 让第 1、3、5、7 位成为偶数个 1（$\oplus$ 是异或：模 2 加）。")),
                    (r'p_2 = d_3 \oplus d_6 \oplus d_7 = 1 \oplus 0 \oplus 1 = 0', T(r"$p_2$ covers positions 2, 3, 6, 7.", r"$p_2$ 管第 2、3、6、7 位。")),
                    (r'p_4 = d_5 \oplus d_6 \oplus d_7 = 1 \oplus 0 \oplus 1 = 0', T(r"$p_4$ covers positions 4, 5, 6, 7.", r"$p_4$ 管第 4、5、6、7 位。")),
                    (r'p_1\,p_2\,d_3\,p_4\,d_5\,d_6\,d_7 = 1\,0\,1\,0\,1\,0\,1', T(r"In position order: the codeword 1010101.", r"按位置顺序排好：码字 1010101。"))],
                   blank=(3, '0', T(r"$p_4 = d_5 \oplus d_6 \oplus d_7$ with $d_5 = 1$, $d_6 = 0$, $d_7 = 1$. What is $p_4$?", r"$p_4 = d_5 \oplus d_6 \oplus d_7$，其中 $d_5 = 1$、$d_6 = 0$、$d_7 = 1$。$p_4$ 是多少？")),
                   skill=HC),
            derive('p2-b', T('Part (b): finding the wrong bit', '第 (b) 问：找出错的那一位'),
                   [(r'b_1 \ldots b_7 = 1\,0\,1\,0\,1\,1\,1', T(r"The received bits, positions 1 to 7.", r"收到的位，第 1 到 7 位。")),
                    (r'c_1 = b_1 \oplus b_3 \oplus b_5 \oplus b_7 = 1 \oplus 1 \oplus 1 \oplus 1 = 0', T(r"Recompute check 1 over its whole group: even, so it passes.", r"重新算校验 1 的整组：偶数个 1，通过。")),
                    (r'c_2 = b_2 \oplus b_3 \oplus b_6 \oplus b_7 = 0 \oplus 1 \oplus 1 \oplus 1 = 1', T(r"Check 2 fails.", r"校验 2 不通过。")),
                    (r'c_4 = b_4 \oplus b_5 \oplus b_6 \oplus b_7 = 0 \oplus 1 \oplus 1 \oplus 1 = 1', T(r"Check 4 fails.", r"校验 4 不通过。")),
                    (r'2 + 4 = 6', T(r"The failed checks add up to the position of the wrong bit: the only position covered by checks 2 and 4 but not by check 1 is 6.", r"不通过的校验加起来，就是出错的位置：被校验 2 和 4 覆盖、却不被校验 1 覆盖的位置只有 6。")),
                    (r'1010111 \;\to\; 1010101 \;\to\; 1101', T(r"Flip bit 6 back to get the codeword sent, and read the data from positions 3, 5, 6 and 7: 1101.", r"把第 6 位翻回来，得到发出的码字，再从第 3、5、6、7 位读出数据：1101。"))],
                   blank=(4, '6', T(r"Checks 2 and 4 failed and check 1 passed. Which position is wrong?", r"校验 2 和 4 不通过，校验 1 通过。哪一位错了？")),
                   skill=HC),
            read('p2-answer', T('Problem 2: a full-mark answer', '题 2：满分答案'),
                 p(T(r"Show the check bits computed and the checks redone: the examiner wants the positions each check covers, not only the final bit strings.", r"写出算出的校验位和重做的校验：阅卷人要看每个校验覆盖哪些位置，不只是最后的位串。")),
                 paper(PPA(),
                       T(r"(a) The data bits go in positions 3, 5, 6, 7 (1, 1, 0, 1). With even parity, $p_1 = d_3 \oplus d_5 \oplus d_7 = 1$, $p_2 = d_3 \oplus d_6 \oplus d_7 = 0$, $p_4 = d_5 \oplus d_6 \oplus d_7 = 0$. The codeword sent is 1010101.",
                         r"(a) 数据位放在第 3、5、6、7 位（1、1、0、1）。按偶校验，$p_1 = d_3 \oplus d_5 \oplus d_7 = 1$，$p_2 = d_3 \oplus d_6 \oplus d_7 = 0$，$p_4 = d_5 \oplus d_6 \oplus d_7 = 0$。发出的码字是 1010101。"),
                       T(r"(b) Recomputing the checks on 1010111: positions 1, 3, 5, 7 give 0 (pass); positions 2, 3, 6, 7 give 1 (fail); positions 4, 5, 6, 7 give 1 (fail). The failed checks give 2 + 4 = 6, so bit 6 is in error. The corrected codeword is 1010101, and the data sent was 1101.",
                         r"(b) 对 1010111 重新计算各校验：第 1、3、5、7 位得 0（通过）；第 2、3、6、7 位得 1（不通过）；第 4、5、6、7 位得 1（不通过）。不通过的校验相加 2 + 4 = 6，所以第 6 位出错。纠正后的码字是 1010101，发送的数据是 1101。"),
                       answer=True)),
            read('wider', T('The Internet checksum, and what each code can do', '互联网校验和，以及每种码能做什么'),
                 p(T(r"The third code the course computes is the **Internet checksum**: split the data into words, add them, wrap any carry out of the top back into the bottom (one's-complement addition), and send the complement of the sum. The course's example, with 5-bit words for short:",
                     r"课上算过的第三种码是**互联网校验和**：把数据切成若干个字，相加，从最高位溢出的进位加回最低位（反码加法），发送和的反码。课上的例子，为了简短用 5 位的字：")),
                 {'type': 'code', 'lang': 'text', 'code': '  00110\n+ 10001\n= 10111\n+ 11001\n= 1 10000   carry wraps around: 10000 + 1 = 10001\n+ 01011\n= 11100\nchecksum = complement of 11100 = 00011'},
                 p(T(r"The receiver adds all the words, the checksum included, the same way; a sum of all 1s (11111) means no error was seen.", r"接收方用同样的方法把所有字连同校验和加起来；结果全是 1（11111），就说明没看出错误。")),
                 table([T('Code', '码'), T('Check bits', '校验位'), T('Does', '能做什么')],
                       [T('Parity bit', '奇偶校验位'), '1', T('detects any single error (distance 2)', '检出任何单个错（距离 2）')],
                       [T('Internet checksum', '互联网校验和'), '16', T('detects errors; distance 2, so some double errors slip through', '检错；距离 2，有些双错会漏掉')],
                       [T('CRC-32', 'CRC-32'), '32', T('detects all single and double errors and every burst up to 32 bits (distance 4)', '检出所有单错、双错，以及 32 位以内的所有突发错（距离 4）')],
                       [T('Hamming code', '汉明码'), T('3 for 4 data bits', '4 个数据位配 3 个'), T('corrects any single error', '纠正任何单个错')]),
                 p(T(r"A Hamming code corrects one error; with two, the failed checks point at a third, innocent bit, which it then wrongly flips.", r"汉明码能纠正一个错；要是错了两位，不通过的校验会指向第三个无辜的位，它反而把那一位翻错。")),
                 chapter=WIDER_CH()),
            choice('try-crc', T('Your turn: another CRC', '你来：再算一个 CRC'), CR,
                   T(rf"The data {try_data} is sent with the generator $x^2 + 1$. What bit string is sent?", rf"用生成多项式 $x^2 + 1$ 发送数据 {try_data}。发出的位串是什么？"),
                   [(T(f'{try_data}{try_rem}', f'{try_data}{try_rem}'), True),
                    (T(f'{try_data}00', f'{try_data}00'), T(r"The zeros are only placeholders: the remainder replaces them.", r"补的 0 只是占位：要用余数替换它们。")),
                    (T(f'{try_data}{try_rem}{try_rem}', f'{try_data}{try_rem}{try_rem}'), T(r"The generator has degree 2, so exactly 2 check bits are added.", r"生成多项式的次数是 2，所以只加 2 个校验位。"))],
                   T(rf"$x^2 + 1$ is 101. Append 00, divide {try_data}00 by 101 modulo 2: the remainder is {try_rem}, so {try_data}{try_rem} is sent.", rf"$x^2 + 1$ 即 101。补 00，用 101 对 {try_data}00 做模 2 除法：余数是 {try_rem}，所以发送 {try_data}{try_rem}。"), chapter=TRY_CH()),
            number('try-bits', T('Your turn: check bits for 11 data bits', '你来：11 个数据位的校验位'), HC,
                   T(r"How many check bits does a Hamming code need to correct single errors in 11 data bits?", r"汉明码要纠正 11 个数据位中的单个错误，需要多少个校验位？"),
                   4, T(r"The course's rule: $2^k - k - 1 \ge n$. With $k = 4$, $16 - 4 - 1 = 11$: exactly enough, a 15-bit codeword.", r"课上的规则：$2^k - k - 1 \ge n$。$k = 4$ 时 $16 - 4 - 1 = 11$：正好够，码字 15 位。"), tolerance=0, purpose='check',
                   hints=[T(r"Find the smallest $k$ with $2^k - k - 1 \ge 11$.", r"找满足 $2^k - k - 1 \ge 11$ 的最小 $k$。")]),
            choice('try-syndrome', T('Your turn: one failed check', '你来：只有一个校验不通过'), HC,
                   T(r"A receiver recomputes the three checks of a 7-bit Hamming codeword: check 1 fails, checks 2 and 4 pass. What has happened?", r"接收方重新计算 7 位汉明码字的三个校验：校验 1 不通过，校验 2 和 4 通过。发生了什么？"),
                   [(T(r"Bit 1, the check bit itself, was flipped", r"第 1 位，也就是校验位本身，被翻转了"), True),
                    (T(r"Bit 3 was flipped", r"第 3 位被翻转了"), T(r"Bit 3 is covered by checks 1 and 2, so both would fail.", r"第 3 位同时被校验 1 和 2 覆盖，那样两个都会不通过。"), 'hamming-data-positions'),
                    (T(r"Nothing: one failed check is not enough to show an error", r"没事：只有一个校验不通过，不足以说明出错"), T(r"Any failed check shows an error; the failed checks add up to its position, here 1.", r"任何一个校验不通过都说明出了错；不通过的校验加起来就是出错的位置，这里是 1。"))],
                   T(r"Only position 1 is covered by check 1 alone. Check bits can be hit by noise too, and the code corrects them the same way.", r"只被校验 1 单独覆盖的位置只有第 1 位。校验位本身也会被噪声打中，汉明码照样能把它纠正过来。")),
        ],
    )


def L_hard_ethernet():
    MF, EF, EP, SE = 'karx4s.min-frame-size', 'karx4s.ethernet-frame', 'karx4s.ethernet-performance', 'karx4s.switched-ethernet'
    return dict(
        id=f'{CID}-hard-ethernet', title=T("Ethernet's shortest frame: CSMA/CD at 1 Gbps over 1 km", '以太网的最短帧：1 Gbps、1 公里的 CSMA/CD'),
        description=T('Why a CSMA/CD frame must last at least twice the cable\'s propagation time, the minimum frame for a gigabit network, and what that means for classic and switched Ethernet.', '为什么 CSMA/CD 的帧至少要持续电缆传播时间的两倍，千兆网络的最小帧长，以及这对经典以太网和交换式以太网意味着什么。'),
        minutes=25,
        skills=skills(MF, EF, EP, SE),
        misconceptions=[{'id': 'one-tau', 'description': T('Using one propagation time τ instead of the round trip 2τ', '用单程传播时间 τ，而不是往返的 2τ')}],
        steps=[
            read('problem', T('The problem, as printed', '题目原文'),
                 paper(PP(), T(r"Consider building a CSMA/CD network running at 1 Gbps over a 1 km cable with no repeaters. The signal speed in the cable is 200,000 km/sec. What is the minimum frame size?",
                               r"设想建一个运行在 1 Gbps、电缆长 1 公里、没有中继器的 CSMA/CD 网络。信号在电缆中的速度是 200,000 公里/秒。最小帧长是多少？")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**CSMA/CD**: classic Ethernet's way of sharing one cable. Listen before sending; while sending, keep listening, and stop at once if a collision is heard (collision detection).", r"**CSMA/CD**：经典以太网共用一根电缆的办法。发之前先听；发的时候一直听着，一听到冲突就马上停（冲突检测）。"),
                    T(r"**1 Gbps**: $10^9$ bits per second, so one bit takes 1 ns to send.", r"**1 Gbps**：每秒 $10^9$ 位，所以发一位要 1 ns。"),
                    T(r"**1 km, no repeaters**: the two stations farthest apart are 1 km apart. **200,000 km/s** is how fast the signal travels along the cable, about two thirds of the speed of light.", r"**1 公里，没有中继器**：相距最远的两个站隔 1 公里。**200,000 公里/秒**是信号沿电缆传播的速度，大约是光速的三分之二。"),
                    T(r"**Minimum frame size**: the shortest frame for which collision detection still works, in bits or bytes.", r"**最小帧长**：冲突检测仍然有效的最短的帧，用位或字节表示。")),
                 chapter=Q_CH()),
            read('why', T('Why a frame cannot be too short', '帧为什么不能太短'),
                 p(T(r"A CSMA/CD sender learns of a collision only by hearing it **while it is still sending**. Once its last bit is out, it stops listening for collisions and assumes the frame got through. So the frame must last long enough for news of the worst collision to come back.",
                     r"CSMA/CD 的发送方只有**在还在发的时候**听到冲突，才知道撞了。最后一位发出去之后，它就不再监听冲突，认为这一帧成功了。所以帧必须持续得够久，久到最坏情况下冲突的消息能传回来。")),
                 svg(drawn(fig_collision), T('A space-time diagram with A on the left and B on the right, time going down. A starts at 0; its signal reaches B at τ. B starts just before τ, and the collision noise travels back, reaching A at 2τ. A bar beside A shows that A must still be sending at 2τ.',
                                             '时空图：A 在左，B 在右，时间向下。A 在 0 时刻开始发；信号在 τ 时刻到达 B。B 在 τ 之前一点点开始发，冲突的噪声往回走，在 2τ 时刻到达 A。A 旁边的条表示 A 到 2τ 时必须还在发。'),
                     T(r"The worst case. A's first bit takes $\tau$ to reach B; B, hearing nothing yet, starts just before it arrives; the collision takes another $\tau$ to come back. A hears it at $2\tau$.",
                       r"最坏的情况。A 的第一位要 $\tau$ 才到 B；B 那时还什么都没听到，就在它到达前一刻开始发；冲突的噪声再走 $\tau$ 回来。A 在 $2\tau$ 时听到。")),
                 p(T(r"Here $\tau$ is the time a signal takes to cross the whole cable. The worst case puts the two stations at opposite ends: A starts; B, which cannot hear A yet, starts just before A's signal arrives; the collision happens at B's end, and its noise takes another $\tau$ to reach A. The course's slide: collisions can take as long as $2\tau$ to detect. So the frame's transmission time $T_f$ must be at least $2\tau$:",
                     r"这里 $\tau$ 是信号走完整根电缆所需的时间。最坏情况是两个站在电缆两端：A 开始发；B 还听不到 A，就在 A 的信号到达前一刻也开始发；冲突发生在 B 那头，噪声还要再走 $\tau$ 才到 A。课件上说：检测到冲突最长可能要 $2\tau$。所以帧的发送时间 $T_f$ 至少要 $2\tau$：")),
                 math_(r'T_f \ge 2\tau \qquad\Longrightarrow\qquad L_{\min} = 2\tau \times B'),
                 p(T(r"where $B$ is the bandwidth: the shortest frame is the number of bits sent during one round trip along the cable.", r"其中 $B$ 是带宽：最短的帧，就是沿电缆跑一个来回的时间里发出的位数。")),
                 chapter=IDEAS_CH()),
            derive('worked', T('The problem, worked', '这道题：完整解法'),
                   [(r'\tau = \frac{1\ \text{km}}{200\,000\ \text{km/s}} = 5 \times 10^{-6}\ \text{s} = 5\ \mu\text{s}', T(r"The time to cross the 1 km cable once.", r"信号走完 1 公里电缆一次的时间。")),
                    (r'2\tau = 10\ \mu\text{s}', T(r"The worst-case time to hear a collision.", r"最坏情况下听到冲突所需的时间。")),
                    (r'L_{\min} = 10 \times 10^{-6}\ \text{s} \times 10^9\ \text{bits/s} = 10\,000\ \text{bits}', T(r"The frame must still be on the wire after $10\ \mu$s: at 1 Gbps that is 10 000 bits.", r"$10\ \mu$s 之后帧还得在线上：1 Gbps 下就是 10 000 位。")),
                    (r'10\,000 / 8 = 1250\ \text{bytes}', T(r"In bytes.", r"换成字节。"))],
                   blank=(2, '10000', T(r"How many bits does a 1 Gbps sender put out in $10\ \mu$s?", r"1 Gbps 的发送方在 $10\ \mu$s 里发出多少位？")),
                   outro=T(r"**Answer:** 10 000 bits, or 1250 bytes. Compare classic Ethernet's 64 bytes: at gigabit speed a frame is over before its first bit could cross a long cable and back.", r"**答案：**10 000 位，即 1250 字节。对比经典以太网的 64 字节：在千兆速度下，一帧还没等第一位在长电缆上跑个来回就发完了。"),
                   skill=MF),
            read('answer', T('A full-mark answer', '一份满分答案'),
                 paper(PPA(),
                       T(r"For collision detection to work, a station must still be transmitting when news of a collision gets back to it, and in the worst case (stations at opposite ends) that takes the round-trip propagation time 2τ.", r"冲突检测要起作用，冲突的消息传回来时，发送站必须还在发送；最坏情况下（两站位于两端），这需要往返传播时间 2τ。"),
                       T(r"τ = 1 km / 200,000 km/s = 5 µs, so 2τ = 10 µs. At 1 Gbps, the minimum frame is 10 µs × 10⁹ bits/s = 10,000 bits = 1250 bytes.", r"τ = 1 km / 200,000 km/s = 5 µs，所以 2τ = 10 µs。1 Gbps 下，最小帧长为 10 µs × 10⁹ bit/s = 10,000 位 = 1250 字节。"),
                       answer=True),
                 p(T(r"The marks are in the rule ($2\tau$, and why) as much as in the number. The usual slip is to use one $\tau$, which gives 625 bytes.", r"分在规则上（$2\tau$ 以及为什么），和在数字上一样多。常见的错是只用一个 $\tau$，得出 625 字节。")),
                 chapter=PAPER_CH()),
            read('wider', T('Classic Ethernet, and why fast Ethernet is switched', '经典以太网，以及快速以太网为什么用交换机'),
                 p(T(r"Classic Ethernet ran at 10 Mbps with a minimum frame of **64 bytes** (512 bits, $51.2\ \mu$s). A data field shorter than 46 bytes is padded up to it: that is the frame's pad field on the course's slide. After a collision a station waits a random number of these $51.2\ \mu$s slots, chosen from 0 to $2^i - 1$ after the $i$-th collision in a row: **binary exponential backoff**, which spreads the retries further apart the busier the cable is.",
                     r"经典以太网的速率是 10 Mbps，最小帧长 **64 字节**（512 位，$51.2\ \mu$s）。数据部分不足 46 字节就补齐：这就是课件上帧格式里的填充字段。冲突之后，站等待随机个这样的 $51.2\ \mu$s 时隙，连续第 $i$ 次冲突后从 0 到 $2^i - 1$ 里随机选：这就是**二进制指数退避**，电缆越忙，重试就错得越开。")),
                 p(T(r"The course's efficiency formula shows the problem with going faster on one shared cable:", r"课件上的效率公式说明了在一根共享电缆上提速的难处：")),
                 math_(r'\eta = \frac{1}{1 + 2BLe/(cF)}'),
                 p(T(r"with $B$ the bandwidth, $L$ the cable length, $c$ the signal speed and $F$ the frame length. A higher $B$ or a longer $L$, for the same frames, lowers the efficiency: more bits fit into each collision window, so each collision wastes more. That is why fast Ethernet is **switched**: each cable joins one computer to its own switch port, both directions can send at once, there is no shared channel and nothing to collide, and CSMA/CD is no longer needed.",
                     r"其中 $B$ 是带宽，$L$ 是电缆长度，$c$ 是信号速度，$F$ 是帧长。帧长不变时，$B$ 越高或 $L$ 越长，效率越低：每个冲突窗口里装下的位更多，每次冲突浪费得也更多。这就是快速以太网用**交换机**的原因：每根电缆只把一台电脑接到交换机的一个端口，两个方向可以同时发，没有共享信道，也就没有冲突可言，CSMA/CD 也就用不上了。")),
                 chapter=WIDER_CH()),
            number('try-100', T('Your turn: 100 Mbps over 200 m', '你来：100 Mbps、200 米'), MF,
                   T(r"A CSMA/CD network runs at 100 Mbps over a 200 m cable, with a signal speed of $2 \times 10^8$ m/s. What is the minimum frame size, in bits?", r"一个 CSMA/CD 网络运行在 100 Mbps，电缆长 200 米，信号速度 $2 \times 10^8$ m/s。最小帧长是多少位？"),
                   200, T(r"$\tau = 200 / (2 \times 10^8) = 1\ \mu$s, so $2\tau = 2\ \mu$s, and $2 \times 10^{-6} \times 10^8 = 200$ bits.", r"$\tau = 200 / (2 \times 10^8) = 1\ \mu$s，所以 $2\tau = 2\ \mu$s，$2 \times 10^{-6} \times 10^8 = 200$ 位。"),
                   tolerance=0, unit=T('bits', '位'), purpose='check', chapter=TRY_CH(),
                   hints=[T(r"Find $2\tau$ first, then multiply by the bandwidth.", r"先求 $2\tau$，再乘带宽。")]),
            number('try-reach', T('Your turn: how far 64 bytes reach', '你来：64 字节能跨多远'), MF,
                   T(r"Classic Ethernet sends at 10 Mbps with a minimum frame of 64 bytes. With a signal speed of $2 \times 10^8$ m/s and nothing else slowing the signal, what is the longest cable on which collisions are always detected, in metres?", r"经典以太网以 10 Mbps 发送，最小帧长 64 字节。信号速度 $2 \times 10^8$ m/s，不计其他延迟，电缆最长多少米，冲突才总能被检测到？"),
                   5120, T(r"512 bits at 10 Mbps last $51.2\ \mu$s $= 2\tau$, so $\tau = 25.6\ \mu$s and the cable is $25.6 \times 10^{-6} \times 2 \times 10^8 = 5120$ m. The standard allowed only 2500 m, because repeaters and transceivers add delay.", r"512 位在 10 Mbps 下持续 $51.2\ \mu$s $= 2\tau$，所以 $\tau = 25.6\ \mu$s，电缆长 $25.6 \times 10^{-6} \times 2 \times 10^8 = 5120$ 米。标准只允许 2500 米，因为中继器和收发器还会增加延迟。"),
                   tolerance=0, unit=T('m', '米'), purpose='check'),
            choice('try-short', T('Your turn: a frame too short', '你来：太短的帧'), MF,
                   T(r"On the problem's network, a station sends a 500-byte frame and it collides with a frame from the far end of the cable. What can happen?", r"在题目的网络上，一个站发了一个 500 字节的帧，和电缆另一头发来的帧撞上了。可能会怎样？"),
                   [(T(r"The sender finishes before the collision noise reaches it, assumes success, and the frame is lost without the MAC layer noticing", r"冲突噪声还没传回来，发送方就发完了，以为成功了；帧丢了，MAC 层却没察觉"), True),
                    (T(r"The sender detects the collision after $\tau$ and resends", r"发送方在 $\tau$ 后检测到冲突，于是重发"), T(r"Detection can take $2\tau$; a 500-byte frame lasts only $4\ \mu$s, less than $10\ \mu$s.", r"检测可能要 $2\tau$；500 字节的帧只持续 $4\ \mu$s，比 $10\ \mu$s 短。"), 'one-tau'),
                    (T(r"Nothing: CSMA/CD listens before sending, so collisions cannot happen", r"没事：CSMA/CD 发之前先听，所以不会冲突"), T(r"Listening first cannot hear a signal that has not arrived yet: the far station started before A's bits reached it.", r"先听也听不到还没传过来的信号：远端的站在 A 的位到达之前就开始发了。"))],
                   T(r"500 bytes at 1 Gbps last $4\ \mu$s, but the noise may take $10\ \mu$s to return. The loss is left to a higher layer to discover.", r"500 字节在 1 Gbps 下只持续 $4\ \mu$s，噪声却可能要 $10\ \mu$s 才回来。这个丢失只能留给上层去发现。")),
        ],
    )


def L_hard_fragments():
    FG, PM, DG = '4jmwbh.fragmentation', '4jmwbh.path-mtu-discovery', 'ra9r8e.ipv4-datagram'
    return dict(
        id=f'{CID}-hard-fragments', title=T('Fragmenting a datagram: lengths, offsets and the MF flag', '数据报分片：长度、偏移和 MF 标志'),
        description=T('Why a router cuts a datagram into fragments, which header fields let the destination put it back together, and how to work out every fragment\'s length, offset and MF flag, including the multiple-of-8 trap.', '路由器为什么把数据报切成分片，哪些首部字段让目的主机把它拼回去，以及怎样算出每个分片的长度、偏移和 MF 标志，包括 8 的倍数这个陷阱。'),
        minutes=25,
        skills=skills(FG, PM, DG),
        misconceptions=[{'id': 'offset-in-bytes', 'description': T('Giving the fragment offset in bytes instead of 8-byte units', '把分片偏移写成字节数，而不是以 8 字节为单位')},
                        {'id': 'header-once', 'description': T('Forgetting that every fragment carries its own 20-byte header', '忘了每个分片都要带自己的 20 字节首部')}],
        steps=[
            read('problem', T('The problem, as printed', '题目原文'),
                 paper(PP(), T(r"An IP datagram of 4000 bytes (a 20-byte header with no options, and 3980 bytes of data) arrives at a router that must forward it over a link whose MTU is 1500 bytes.", r"一个 4000 字节的 IP 数据报（20 字节首部，没有选项；3980 字节数据）到达一台路由器，路由器要把它转发到一条 MTU 为 1500 字节的链路上。"),
                       T(r"How many fragments are sent? For each fragment, give its total length, its fragment offset and its MF flag.", r"会发出几个分片？对每个分片，给出它的总长度、分片偏移和 MF 标志。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**MTU** (maximum transmission unit): the largest packet a link can carry, header included.", r"**MTU**（最大传输单元）：一条链路能运载的最大分组，包括首部。"),
                    T(r"**Total length**: the IP header field that gives the size of each fragment, its header included.", r"**总长度**：IP 首部里的字段，给出每个分片的大小，包括它的首部。"),
                    T(r"**Fragment offset** and **MF** (more fragments): the header fields that say where a fragment's data belongs in the original and whether more fragments follow. Both are built below.", r"**分片偏移**和 **MF**（还有分片）：首部里说明分片的数据在原数据报中的位置、后面还有没有分片的字段。下面从头讲。")),
                 chapter=Q_CH()),
            read('why', T('Cutting a datagram, and putting it back', '把数据报切开，再拼回去'),
                 p(T(r"Every network has its own MTU, set by its hardware and its standards (1500 bytes for Ethernet). When a datagram is larger than the MTU of the next link, the router cuts it into **fragments**, each a datagram of its own with its own header. They travel separately and are put back together only at the **destination**.",
                     r"每种网络都有自己的 MTU，由硬件和标准决定（以太网是 1500 字节）。数据报比下一条链路的 MTU 大时，路由器就把它切成若干**分片**，每个分片都是一个带自己首部的数据报。它们各自走，到了**目的主机**才拼回去。")),
                 p(T(r"Three header fields make that possible (the course's IPv4 header):", r"有三个首部字段让这件事成为可能（课上讲的 IPv4 首部）：")),
                 ul(T(r"**Identification**: the same in every fragment of one datagram, so the destination knows which pieces belong together.", r"**标识**（Identification）：同一个数据报的所有分片都相同，目的主机靠它知道哪些分片是一起的。"),
                    T(r"**MF**, more fragments: 1 in every fragment except the last.", r"**MF**（还有分片）：除了最后一个，每个分片都是 1。"),
                    T(r"**Fragment offset**: where this fragment's data starts in the original data, counted in **units of 8 bytes**. The field has 13 bits while the total length has 16, so offsets can only name every 8th byte. Every fragment except the last must therefore carry a multiple of 8 data bytes.",
                      r"**分片偏移**：这个分片的数据在原数据里从哪儿开始，以 **8 字节为单位**。这个字段只有 13 位，而总长度有 16 位，所以偏移只能每隔 8 个字节标一个位置。因此除了最后一个分片，每个分片携带的数据都必须是 8 的倍数。")),
                 svg(drawn(fig_fragments), T('The 4000-byte datagram: a 20-byte header and 3980 bytes of data. Below, three fragments, each with its own header: 1480 bytes of data at offset 0 with MF 1; 1480 at offset 185 with MF 1; 1020 at offset 370 with MF 0.',
                                             '4000 字节的数据报：20 字节首部加 3980 字节数据。下面是三个分片，各带自己的首部：1480 字节数据，偏移 0，MF 1；1480 字节，偏移 185，MF 1；1020 字节，偏移 370，MF 0。'),
                     T(r"The data is cut, not the header: each fragment gets a fresh 20-byte header in front of its piece.", r"切的是数据，不是首部：每个分片在自己那段数据前面都配一个新的 20 字节首部。")),
                 chapter=IDEAS_CH()),
            derive('worked', T('The problem, worked', '这道题：完整解法'),
                   [(r'1500 - 20 = 1480\ \text{bytes}', T(r"Each fragment needs its own 20-byte header, so at most 1480 bytes of data fit.", r"每个分片都要自己的 20 字节首部，所以最多装 1480 字节数据。")),
                    (r'1480 / 8 = 185', T(r"1480 is a multiple of 8, so it can be used as it is.", r"1480 是 8 的倍数，可以直接用。")),
                    (r'3980 = 1480 + 1480 + 1020', T(r"The 3980 bytes of data need three fragments.", r"3980 字节数据需要三个分片。")),
                    (r'0,\quad 1480/8 = 185,\quad 2960/8 = 370', T(r"The offsets: where each piece starts in the data, divided by 8.", r"偏移：每段在数据里的起点，除以 8。")),
                    (r'1480 + 20 = 1500,\quad 1480 + 20 = 1500,\quad 1020 + 20 = 1040', T(r"The total lengths: data plus a 20-byte header each. MF is 1, 1, 0: only the last says no more follow.", r"总长度：各自的数据加 20 字节首部。MF 依次是 1、1、0：只有最后一个表示后面没有了。"))],
                   blank=(3, '370', T(r"The third fragment's data starts at byte 2960 of the data. What is its fragment offset?", r"第三个分片的数据从数据的第 2960 字节开始。它的分片偏移是多少？")),
                   skill=FG),
            read('answer', T('A full-mark answer', '一份满分答案'),
                 paper(PPA(),
                       T(r"Each fragment carries its own 20-byte header, so at most 1500 − 20 = 1480 bytes of data (a multiple of 8, as offsets count 8-byte units). The 3980 bytes of data need 3 fragments: 1480 + 1480 + 1020. All three keep the original datagram's identification.", r"每个分片带自己的 20 字节首部，所以最多携带 1500 − 20 = 1480 字节数据（是 8 的倍数，因为偏移以 8 字节为单位）。3980 字节数据需要 3 个分片：1480 + 1480 + 1020。三个分片都保留原数据报的标识。"),
                       answer=True),
                 table([T('Fragment', '分片'), T('Total length', '总长度'), T('Data', '数据'), T('Offset', '偏移'), T('MF', 'MF')],
                       ['1', '1500', '1480', '0', '1'], ['2', '1500', '1480', '185', '1'], ['3', '1040', '1020', '370', '0']),
                 p(T(r"The two usual slips: giving the offset in bytes (1480, 2960) rather than in units of 8; and forgetting that every fragment needs its own header (which would give 1500-byte pieces of data).", r"两个常见的错：把偏移写成字节数（1480、2960），而不是 8 字节为单位；忘了每个分片都要自己的首部（那样会得出 1500 字节一段的数据）。")),
                 chapter=PAPER_CH()),
            read('wider', T('The multiple-of-8 trap, and not fragmenting at all', '8 的倍数陷阱，以及干脆不分片'),
                 p(T(r"Here 1480 happened to be a multiple of 8. With an MTU of 1006, the room for data is 986 bytes, which is not: every fragment but the last can carry only **984**, the largest multiple of 8 that fits.",
                     r"这道题里 1480 恰好是 8 的倍数。如果 MTU 是 1006，留给数据的是 986 字节，不是 8 的倍数：除最后一个以外，每个分片只能装 **984** 字节，也就是装得下的最大的 8 的倍数。")),
                 p(T(r"Fragmentation has costs: if any fragment is lost, the whole datagram is lost, and reassembly takes work and memory at the destination. The course's alternative is **path MTU discovery**: the sender sets the **DF** (don't fragment) bit. A router that would have to fragment drops the packet instead and sends back an ICMP message giving its MTU, and the sender makes its packets smaller. After a few tries, the packets fit the whole path.",
                     r"分片是有代价的：任何一个分片丢了，整个数据报就丢了；重组还要占用目的主机的处理和内存。课上讲的另一条路是**路径 MTU 发现**：发送方设置 **DF**（不要分片）位。本来要分片的路由器改为丢弃这个分组，并回一个 ICMP 消息告知自己的 MTU，发送方就把分组改小。试几次之后，分组就能通过整条路径了。")),
                 chapter=WIDER_CH()),
            choice('try-984', T('Your turn: an MTU of 1006', '你来：MTU 为 1006'), FG,
                   T(r"A 2000-byte datagram (20-byte header) must cross a link with an MTU of 1006 bytes. How many bytes of data does each fragment but the last carry?", r"一个 2000 字节的数据报（20 字节首部）要经过一条 MTU 为 1006 字节的链路。除最后一个外，每个分片携带多少字节数据？"),
                   [(T('984', '984'), True),
                    (T('986', '986'), T(r"986 is not a multiple of 8, and the next fragment's offset must be.", r"986 不是 8 的倍数，而下一个分片的偏移必须能用 8 字节为单位表示。"), 'offset-in-bytes'),
                    (T('1006', '1006'), T(r"The fragment's 20-byte header must fit in the MTU too.", r"分片自己的 20 字节首部也得算进 MTU。"), 'header-once')],
                   T(r"$1006 - 20 = 986$, rounded down to a multiple of 8: 984. The 1980 bytes of data become 984 + 984 + 12, at offsets 0, 123 and 246.", r"$1006 - 20 = 986$，向下取到 8 的倍数：984。1980 字节数据分成 984 + 984 + 12，偏移依次是 0、123、246。"), chapter=TRY_CH()),
            number('try-offset', T('Your turn: the last offset', '你来：最后一个偏移'), FG,
                   T(r"In that case, what is the fragment offset of the last fragment?", r"在这种情况下，最后一个分片的分片偏移是多少？"),
                   246, T(r"Its data starts at byte $984 \times 2 = 1968$, and $1968 / 8 = 246$.", r"它的数据从第 $984 \times 2 = 1968$ 字节开始，$1968 / 8 = 246$。"), tolerance=0, purpose='check'),
            choice('try-df', T('Your turn: DF set', '你来：设置了 DF'), PM,
                   T(r"A datagram with the DF bit set reaches a router whose next link's MTU is too small. What does the router do?", r"一个设置了 DF 位的数据报到达一台路由器，下一条链路的 MTU 太小。路由器怎么做？"),
                   [(T(r"Drops it and sends the sender an ICMP message with the MTU", r"丢弃它，并给发送方回一个带 MTU 的 ICMP 消息"), True),
                    (T(r"Fragments it anyway", r"照样分片"), T(r"DF means *don't fragment*: the router must not.", r"DF 的意思就是“不要分片”：路由器不能分。")),
                    (T(r"Sends it in one piece and lets the link truncate it", r"整个发出去，让链路截断"), T(r"A link cannot carry a packet larger than its MTU at all.", r"链路根本无法运载超过 MTU 的分组。"))],
                   T(r"That message is what path MTU discovery relies on: the sender learns the limit and sends smaller packets.", r"路径 MTU 发现靠的就是这条消息：发送方得知上限，就改发更小的分组。")),
        ],
    )


CIDR_ORGS = (('A', 4000, 0, 16), ('B', 2000, 16, 8), ('C', 4000, 32, 16), ('D', 8000, 64, 32))


def L_hard_cidr():
    CI, IP, LP = 'ra9r8e.cidr-aggregation', 'ra9r8e.ip-address-prefix', 'ra9r8e.longest-prefix-match'
    P1, P2 = T('Problem 1: allocating blocks', '题 1：分配地址块'), T('Problem 2: aggregating routes', '题 2：聚合路由')
    rows = [[n, str(req), f'198.16.{st}.0', f'198.16.{st + sz - 1}.255', f'198.16.{st}.0/{32 - int(math.log2(sz * 256))}'] for n, req, st, sz in CIDR_ORGS]
    return dict(
        id=f'{CID}-hard-cidr', title=T('Handing out address blocks: CIDR allocation and aggregation', '分配地址块：CIDR 的分配与聚合'),
        description=T('How to give organisations blocks of addresses that are powers of 2 and start on a multiple of their size, and when several prefixes can be aggregated into one.', '怎样给各机构分配大小为 2 的幂、并从自身大小的整数倍开始的地址块，以及几个前缀什么时候能聚合成一个。'),
        minutes=35,
        skills=skills(CI, IP, LP),
        misconceptions=[{'id': 'unaligned-block', 'description': T('Starting a block right after the previous one even when that address is not a multiple of its size', '紧接着上一块就开始分，即使那个地址不是本块大小的整数倍')}],
        steps=[
            read('p1', T('Problem 1, as printed', '题 1 原文'),
                 paper(PP(), T(r"A large number of consecutive IP addresses are available starting at 198.16.0.0. Suppose that four organisations, A, B, C and D, request 4000, 2000, 4000 and 8000 addresses respectively, and in that order.", r"从 198.16.0.0 开始有大量连续的 IP 地址可用。假设 A、B、C、D 四个机构依次申请 4000、2000、4000 和 8000 个地址。"),
                       T(r"For each of these, give the first IP address assigned, the last IP address assigned, and the mask in the w.x.y.z/s notation.", r"对每个机构，给出分配的第一个 IP 地址、最后一个 IP 地址，以及 w.x.y.z/s 形式的掩码。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**Consecutive addresses starting at 198.16.0.0**: a free range to hand out from, lowest first.", r"**从 198.16.0.0 开始的连续地址**：一段空闲的地址，从低往高分。"),
                    T(r"**In that order**: A is served first, then B, C and D, each from the lowest addresses still free.", r"**依次**：先给 A，再给 B、C、D，每次都从还空着的最低地址开始。"),
                    T(r"**w.x.y.z/s**: a prefix, the block's first address and its number of network bits, as in the addressing lesson.", r"**w.x.y.z/s**：一个前缀，即块的第一个地址加网络位数，和地址那一课一样。")),
                 chapter=P1),
            read('rules', T('Two rules for a block', '一个地址块的两条规则'),
                 ol(T(r"**Its size is a power of 2**: the smallest that holds the request. 4000 needs 4096 ($2^{12}$, a /20); 2000 needs 2048 ($2^{11}$, a /21); 8000 needs 8192 ($2^{13}$, a /19).", r"**大小是 2 的幂**：装得下申请数的最小的那个。4000 要 4096（$2^{12}$，/20）；2000 要 2048（$2^{11}$，/21）；8000 要 8192（$2^{13}$，/19）。"),
                    T(r"**It starts at a multiple of its size**. A prefix fixes the network bits and lets the host bits take every value, so the block's first address must have all its host bits 0. A /20 has 12 host bits, so its start is a multiple of 4096.", r"**从自身大小的整数倍开始**。前缀固定网络位，让主机位取遍所有值，所以块的第一个地址的主机位必须全为 0。/20 有 12 位主机位，所以它的起点必须是 4096 的倍数。")),
                 p(T(r"Count in the **third byte**, since every block here is a whole number of 256-address steps: a /20 is 16 values of the third byte, a /21 is 8, a /19 is 32. A /20 must then start at a third byte that is a multiple of 16, a /21 at a multiple of 8, a /19 at a multiple of 32. Where the next free address is not such a multiple, the block skips ahead and leaves a gap, which can be handed out later.",
                     r"按**第三个字节**来数，因为这里每个块都是 256 个地址的整数倍：/20 占第三个字节的 16 个值，/21 占 8 个，/19 占 32 个。于是 /20 必须从第三个字节为 16 的倍数处开始，/21 从 8 的倍数，/19 从 32 的倍数。下一个空闲地址不是这样的倍数时，就跳到下一个倍数，中间留出空档，以后还能再分。")),
                 svg(drawn(fig_cidr), T('A line of third-byte values from 0 to 96 for 198.16.x.0: A, a /20, from 0 to 16; B, a /21, from 16 to 24; free from 24 to 32; C, a /20, from 32 to 48; free from 48 to 64; D, a /19, from 64 to 96.',
                                        '198.16.x.0 中第三个字节从 0 到 96 的数轴：A（/20）占 0 到 16；B（/21）占 16 到 24；24 到 32 空着；C（/20）占 32 到 48；48 到 64 空着；D（/19）占 64 到 96。'),
                     T(r"The four blocks, by their third byte. C cannot start at 24 and D cannot start at 48: neither is a multiple of the block's size.", r"四个块，按第三个字节画出。C 不能从 24 开始，D 不能从 48 开始：都不是本块大小的整数倍。"))),
            derive('p1-worked', T('Problem 1, worked', '题 1：完整解法'),
                   [(r'A:\ 4096 = 2^{12} \to /20,\quad 198.16.0.0 \text{ – } 198.16.15.255', T(r"A starts at the beginning: third byte 0 is a multiple of 16. It covers 16 values of the third byte, 0 to 15.", r"A 从头开始：第三个字节 0 是 16 的倍数。它占第三个字节的 16 个值，0 到 15。")),
                    (r'B:\ 2048 = 2^{11} \to /21,\quad 198.16.16.0 \text{ – } 198.16.23.255', T(r"The next free third byte is 16, a multiple of 8: B fits there, 16 to 23.", r"下一个空闲的第三个字节是 16，是 8 的倍数：B 正好放这儿，16 到 23。")),
                    (r'C:\ 24 \to 32,\quad 198.16.32.0 \text{ – } 198.16.47.255\ (/20)', T(r"The next free is 24, not a multiple of 16; C skips to 32 and covers 32 to 47.", r"下一个空闲的是 24，不是 16 的倍数；C 跳到 32，占 32 到 47。")),
                    (r'D:\ 8192 = 2^{13} \to /19,\quad 48 \to 64,\quad 198.16.64.0 \text{ – } 198.16.95.255', T(r"The next free is 48, not a multiple of 32; D skips to 64 and covers 64 to 95.", r"下一个空闲的是 48，不是 32 的倍数；D 跳到 64，占 64 到 95。"))],
                   blank=(2, '32', T(r"C needs a /20, whose third byte must start at a multiple of 16, and the next free third byte is 24. Where does C start?", r"C 要一个 /20，第三个字节必须从 16 的倍数开始，而下一个空闲的第三个字节是 24。C 从哪儿开始？")),
                   skill=CI),
            read('p1-answer', T('Problem 1: a full-mark answer', '题 1：满分答案'),
                 paper(PPA(), T(r"Each block is the smallest power of 2 that holds the request, and must start at a multiple of its size: A 4096 (/20), B 2048 (/21), C 4096 (/20), D 8192 (/19).", r"每个块取装得下申请数的最小的 2 的幂，并且必须从自身大小的整数倍开始：A 4096（/20），B 2048（/21），C 4096（/20），D 8192（/19）。"), answer=True),
                 table([T('Organisation', '机构'), T('Requested', '申请'), T('First address', '第一个地址'), T('Last address', '最后一个地址'), T('Prefix', '前缀')], *rows),
                 p(T(r"Mention the gaps if there is room: 198.16.24.0 to 198.16.31.255 and 198.16.48.0 to 198.16.63.255 stay free for later requests. The usual slip is to start C at 198.16.24.0, which is not a /20.", r"有空的话提一下空档：198.16.24.0 到 198.16.31.255、198.16.48.0 到 198.16.63.255 留给以后的申请。常见的错是让 C 从 198.16.24.0 开始，那不是一个 /20。"))),
            read('p2', T('Problem 2, as printed', '题 2 原文'),
                 paper(PP(), T(r"A router has just received the following new IP addresses: 57.6.96.0/21, 57.6.104.0/21, 57.6.112.0/21 and 57.6.120.0/21. If all of them use the same outgoing line, can they be aggregated? If so, to what? If not, why not?",
                               r"一台路由器刚收到以下新的 IP 地址：57.6.96.0/21、57.6.104.0/21、57.6.112.0/21 和 57.6.120.0/21。如果它们都走同一条出口线路，能不能聚合？能的话，聚合成什么？不能的话，为什么？")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**Aggregated**: replaced in the routing table by one larger prefix that covers exactly these blocks, so one row does the work of four.", r"**聚合**：在路由表里用一个更大的、正好覆盖这些块的前缀来代替，一行顶四行。"),
                    T(r"**The same outgoing line**: the condition that makes it safe; addresses with different lines cannot share a row.", r"**同一条出口线路**：这是聚合安全的前提；出口不同的地址不能共用一行。")),
                 chapter=P2),
            derive('p2-worked', T('Problem 2, worked', '题 2：完整解法'),
                   [(r'96 = 011\,00000,\ \ 104 = 011\,01000,\ \ 112 = 011\,10000,\ \ 120 = 011\,11000', T(r"The four third bytes in binary. A /21 fixes 16 + 5 bits: the first 5 bits of the third byte.", r"四个第三字节写成二进制。/21 固定 16 + 5 位：第三个字节的前 5 位。")),
                    (r'01100,\ 01101,\ 01110,\ 01111', T(r"Their first 5 bits: they share 011 and take all four values of the next two bits.", r"它们的前 5 位：共同的是 011，后两位取遍了全部四种值。")),
                    (r'16 + 3 = 19', T(r"So together they are exactly the block whose first 19 bits are 57.6 and 011.", r"所以合起来，正好是前 19 位为 57.6 和 011 的那个块。")),
                    (r'57.6.96.0/19\ \ (96 \text{ – } 127)', T(r"One prefix covering third bytes 96 to 127: $4 \times 2048 = 8192$ addresses, no more and no fewer.", r"一个前缀覆盖第三个字节 96 到 127：$4 \times 2048 = 8192$ 个地址，不多也不少。"))],
                   blank=(2, '19', T(r"The four blocks share the first 16 bits and 3 more. What is the length of the aggregated prefix?", r"四个块共享前 16 位，再加 3 位。聚合后的前缀长度是多少？")),
                   skill=CI),
            read('p2-answer', T('Problem 2: a full-mark answer', '题 2：满分答案'),
                 p(T(r"The answer is yes or no with the reason in binary: which bits the blocks share, and that together they fill the larger block.", r"答案是能或不能，并用二进制说明理由：这些块共享哪几位，以及它们合起来是否正好填满更大的块。")),
                 paper(PPA(), T(r"Yes. In binary, the third bytes are 01100000, 01101000, 01110000 and 01111000. The four /21 blocks share their first 19 bits (57.6 and 011) and together cover every value of the remaining bits, so they form exactly one block: 57.6.96.0/19 (third byte 96 to 127). With the same outgoing line, the four entries can be replaced by this single one.",
                                r"能。第三个字节的二进制分别是 01100000、01101000、01110000 和 01111000。这四个 /21 块共享前 19 位（57.6 和 011），合起来又取遍了其余位的所有值，所以正好构成一个块：57.6.96.0/19（第三个字节 96 到 127）。既然出口相同，这四条表项就可以换成这一条。"),
                       answer=True)),
            read('wider', T('When blocks cannot be aggregated', '什么时候不能聚合'),
                 p(T(r"Aggregation needs three things: the same outgoing line; blocks that together fill a whole larger block, with nothing missing; and that larger block correctly aligned. Without 57.6.120.0/21, the other three cannot become one /19: it would also cover 120 to 127, which goes elsewhere.",
                     r"聚合要满足三条：出口相同；几个块合起来正好填满一个更大的块，一点不缺；这个大块的起点要对齐。少了 57.6.120.0/21，剩下三个就不能合成一个 /19：那会把 120 到 127 也包进来，而它们走的是别的路。")),
                 p(T(r"Even then a router can save rows, thanks to longest prefix match: one row for 57.6.96.0/19 on the common line, and one for the exception 57.6.120.0/21 on its own line. The longer prefix wins for addresses in the exception, as in the addressing lesson's London and San Francisco example.",
                     r"即使这样，路由器靠最长前缀匹配也能省行：一行 57.6.96.0/19 指向共同的出口，再一行 57.6.120.0/21 指向它自己的出口，作为例外。落在例外里的地址，更长的前缀胜出，就像地址那一课伦敦和旧金山的例子。")),
                 chapter=WIDER_CH()),
            choice('try-align', T('Your turn: 900 addresses', '你来：900 个地址'), CI,
                   T(r"An organisation needs 900 addresses, and the lowest free address is 10.0.6.0. What block does it get?", r"一个机构需要 900 个地址，最低的空闲地址是 10.0.6.0。它分到哪个块？"),
                   [(T('10.0.8.0/22', '10.0.8.0/22'), True),
                    (T('10.0.6.0/22', '10.0.6.0/22'), T(r"A /22 spans 4 values of the third byte and must start at a multiple of 4; 6 is not one.", r"/22 占第三个字节的 4 个值，必须从 4 的倍数开始；6 不是。"), 'unaligned-block'),
                    (T('10.0.6.0/23', '10.0.6.0/23'), T(r"A /23 holds only 512 addresses.", r"/23 只有 512 个地址。"))],
                   T(r"900 needs 1024 addresses, a /22, which starts at a third byte that is a multiple of 4: the first one free is 8.", r"900 需要 1024 个地址，即 /22，它的第三个字节要从 4 的倍数开始：空着的第一个是 8。"), chapter=TRY_CH()),
            choice('try-agg', T('Your turn: two blocks', '你来：两个块'), CI,
                   T(r"Can 57.6.96.0/21 and 57.6.112.0/21 alone be aggregated into one prefix?", r"57.6.96.0/21 和 57.6.112.0/21 这两个块单独能聚合成一个前缀吗？"),
                   [(T(r"No: the smallest block covering both, 57.6.96.0/19, also contains 104 and 120", r"不能：同时覆盖两者的最小的块 57.6.96.0/19 还包含 104 和 120"), True),
                    (T(r"Yes, into 57.6.96.0/20", r"能，聚合成 57.6.96.0/20"), T(r"57.6.96.0/20 covers third bytes 96 to 111: it includes 104 but not 112.", r"57.6.96.0/20 覆盖第三个字节 96 到 111：包含了 104，却不含 112。"))],
                   T(r"Two blocks merge into one only if they are the two halves of a larger block. 96 and 112 are not adjacent.", r"两个块只有恰好是某个更大块的两半时，才能合成一个。96 和 112 并不相邻。")),
        ],
    )


def L_hard_dijkstra():
    SP, OP, LS = 'xnze5w.shortest-path-dijkstra', 'xnze5w.optimality-sink-tree', 'xnze5w.link-state'
    steps = dijkstra()
    rows = []
    for k, (n, d, prev, tent) in enumerate(steps):
        labels = ', '.join(f'{x} ({dd}, {pp})' for x, (dd, pp) in sorted(tent.items()))
        rows.append([str(k + 1), f'{n} = {d}' + (f' ({prev})' if prev else ''), labels or '–'])
    return dict(
        id=f'{CID}-hard-dijkstra', title=T("Shortest paths by hand: Dijkstra's algorithm", '手算最短路径：Dijkstra 算法'),
        description=T("Tentative and permanent labels, the order in which Dijkstra's algorithm settles each router, why the smallest label is always final, and the shortest path from A to D in an eight-router network.", '临时标号和永久标号，Dijkstra 算法确定各路由器的顺序，为什么最小的标号一定是最终的，以及一个八台路由器网络里 A 到 D 的最短路径。'),
        minutes=30,
        skills=skills(SP, OP, LS),
        misconceptions=[{'id': 'direct-is-shortest', 'description': T('Thinking a direct link is always the shortest path', '以为直连的链路一定是最短路径')}],
        steps=[
            read('problem', T('The problem, as printed', '题目原文'),
                 paper(PP(), T(r"Use Dijkstra's algorithm to find the shortest path from A to D in the network below, where the numbers are the lengths of the links. Show the order in which the nodes are made permanent, with their distances from A.",
                               r"用 Dijkstra 算法求下图网络中从 A 到 D 的最短路径，图中的数字是各链路的长度。写出各节点成为永久节点的顺序，以及它们到 A 的距离。")),
                 svg(drawn(fig_dijkstra), T('Eight routers A to H. Links: A–B 2, A–G 6, B–C 7, B–E 2, E–G 1, E–F 2, F–C 3, C–D 3, F–H 2, G–H 4, H–D 2.', '八台路由器 A 到 H。链路：A–B 2、A–G 6、B–C 7、B–E 2、E–G 1、E–F 2、F–C 3、C–D 3、F–H 2、G–H 4、H–D 2。'),
                     T(r"The network of the problem, as printed.", r"题目里的网络，和卷面一样。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**The lengths of the links**: a cost per link, such as distance or delay. The length of a path is the sum of its links.", r"**链路的长度**：每条链路的代价，比如距离或延迟。一条路径的长度是它各段之和。"),
                    T(r"**Made permanent**: Dijkstra's algorithm gives each node a label, its distance from A so far and the node it came from. A label is **tentative** until the algorithm is sure it is the shortest, then **permanent**.", r"**成为永久节点**：Dijkstra 算法给每个节点一个标号：到目前为止离 A 的距离，以及从哪个节点过来。标号先是**临时的**，等算法确定它最短了，就变成**永久的**。")),
                 chapter=Q_CH()),
            read('idea', T('Settle the nearest node first', '先确定最近的节点'),
                 p(T(r"Dijkstra's algorithm grows the set of nodes whose shortest distance is known, nearest first. Every node carries a label: its best distance from A found so far, and the node it came from. At the start, A is permanent with distance 0, and every other node is unlabelled.",
                     r"Dijkstra 算法从近到远，逐个确定节点的最短距离。每个节点带一个标号：目前找到的离 A 最近的距离，以及从哪个节点过来。一开始，A 是永久节点，距离 0，其他节点都没有标号。")),
                 ol(T(r"Take the node made permanent last. For each neighbour that is not yet permanent, add the link's length to the node's distance; if that beats the neighbour's label, or it has none, relabel it (distance, via this node).", r"拿最后一个成为永久的节点。对它每个还不是永久的邻居，把链路长度加到这个节点的距离上；如果比邻居现有的标号小，或者邻居还没有标号，就改写它的标号（距离，经由这个节点）。"),
                    T(r"Among all tentative labels, the smallest becomes permanent.", r"在所有临时标号里，最小的那个变成永久的。"),
                    T(r"Repeat until the destination is permanent. Its path is read backwards through the *via* parts of the labels.", r"重复，直到目的地成为永久节点。顺着标号里的“经由”往回读，就得到路径。")),
                 p(T(r"Why the smallest tentative label is final: every other way to reach that node leaves the permanent set through some other tentative node, whose label is already at least as large, and the links are never negative. So no later discovery can beat it.",
                     r"为什么最小的临时标号一定是最终的：到达这个节点的任何别的路，都得经过另一个临时节点离开永久集合，而那个节点的标号已经不比它小，链路长度又不会是负的。所以之后不可能再找到更短的。")),
                 chapter=IDEAS_CH()),
            read('table', T('Every step, in one table', '每一步，一张表'),
                 p(T(r"Each row: the node made permanent at that step, with its distance and the node it came from, and the tentative labels left afterwards as (distance, via).", r"每一行：这一步成为永久的节点，连同它的距离和从哪儿来，以及之后还剩下的临时标号，写作（距离，经由）。")),
                 table([T('Step', '步'), T('Made permanent', '成为永久'), T('Tentative labels after', '之后的临时标号')], *rows)),
            derive('worked', T('The steps, with the reason for each', '逐步做，每步说理由'),
                   [(r'A = 0', T(r"A is the source: permanent, distance 0. Label its neighbours: B (2, via A), G (6, via A).", r"A 是源点：永久，距离 0。给它的邻居标号：B（2，经 A），G（6，经 A）。")),
                    (r'B = 2', T(r"The smallest tentative label is B's: make it permanent. Through B: E $2 + 2 = 4$, C $2 + 7 = 9$.", r"最小的临时标号是 B 的：让它成为永久的。经 B：E 是 $2 + 2 = 4$，C 是 $2 + 7 = 9$。")),
                    (r'E = 4', T(r"Next smallest: E. Through E: G $4 + 1 = 5$, better than 6, so G becomes (5, via E); F $4 + 2 = 6$.", r"下一个最小的：E。经 E：G 是 $4 + 1 = 5$，比 6 好，所以 G 改为（5，经 E）；F 是 $4 + 2 = 6$。")),
                    (r'G = 5', T(r"G. Through G: H $5 + 4 = 9$.", r"G。经 G：H 是 $5 + 4 = 9$。")),
                    (r'F = 6', T(r"F. Through F: C $6 + 3 = 9$, no better than 9, so C keeps (9, via B); H $6 + 2 = 8$, better than 9.", r"F。经 F：C 是 $6 + 3 = 9$，并不比 9 好，C 保持（9，经 B）；H 是 $6 + 2 = 8$，比 9 好。")),
                    (r'H = 8', T(r"H. Through H: D $8 + 2 = 10$.", r"H。经 H：D 是 $8 + 2 = 10$。")),
                    (r'C = 9', T(r"C, via B. Through C: D $9 + 3 = 12$, worse than 10.", r"C，经 B。经 C：D 是 $9 + 3 = 12$，比 10 差。")),
                    (r'D = 10', T(r"D, via H. The destination is permanent: stop.", r"D，经 H。目的地成为永久节点：停。")),
                    (r'D \leftarrow H \leftarrow F \leftarrow E \leftarrow B \leftarrow A', T(r"Follow the *via* labels back from D: the path is A, B, E, F, H, D.", r"从 D 顺着“经由”往回走：路径是 A、B、E、F、H、D。"))],
                   blank=(7, '10', T(r"H is permanent at 8, and the link H–D has length 2. C's route would give 12. What is D's distance?", r"H 以 8 成为永久节点，H–D 链路长 2。经 C 会是 12。D 的距离是多少？")),
                   skill=SP),
            read('answer', T('A full-mark answer', '一份满分答案'),
                 paper(PPA(),
                       T(r"Order in which nodes are made permanent (distance from A, previous node): A 0; B 2 (A); E 4 (B); G 5 (E); F 6 (E); H 8 (F); C 9 (B); D 10 (H).", r"各节点成为永久节点的顺序（到 A 的距离，前一个节点）：A 0；B 2 (A)；E 4 (B)；G 5 (E)；F 6 (E)；H 8 (F)；C 9 (B)；D 10 (H)。"),
                       T(r"Shortest path from A to D: A → B → E → F → H → D, of length 2 + 2 + 2 + 2 + 2 = 10.", r"A 到 D 的最短路径：A → B → E → F → H → D，长度 2 + 2 + 2 + 2 + 2 = 10。"),
                       answer=True),
                 svg(drawn(fig_dijkstra, True), T('The same network with the shortest path from A to D marked: A, B, E, F, H, D.', '同一个网络，标出了 A 到 D 的最短路径：A、B、E、F、H、D。'),
                     T(r"The shortest path: five links of length 2. The route through C, which looks more direct, is 12.", r"最短路径：五段长度为 2 的链路。看起来更直的经 C 那条路是 12。")),
                 p(T(r"Show the labels changing, as in the table: the examiner wants to see the algorithm, not only the path. The usual slips are not updating a label when a shorter route appears (G from 6 to 5, H from 9 to 8), and choosing the next node by fewest hops rather than by smallest label.",
                     r"要写出标号的变化，像那张表一样：阅卷人要看的是算法，不只是路径。常见的错是出现更短的路时没有更新标号（G 从 6 改成 5，H 从 9 改成 8），以及按跳数最少、而不是按标号最小来选下一个节点。")),
                 chapter=PAPER_CH()),
            read('wider', T('Where Dijkstra is used', 'Dijkstra 用在哪里'),
                 p(T(r"In **link state routing** (OSPF), every router floods its links to all the others, then runs exactly this algorithm on the whole map, with itself as the source. The result is the **sink tree** of the course's optimality principle seen from the other end: the shortest paths from one router to all the others form a tree, and every part of a shortest path is itself a shortest path (A to F through B and E is a shortest path, because A to D is).",
                     r"在**链路状态路由**（OSPF）里，每台路由器把自己的链路泛洪给所有别的路由器，然后以自己为源点，在整张图上跑的正是这个算法。结果就是课上最优性原理里的**汇集树**（sink tree），只是从另一头看：从一台路由器到所有其他路由器的最短路径构成一棵树，而且最短路径的任何一段本身也是最短路径（经 B、E 从 A 到 F 是最短的，因为 A 到 D 是最短的）。")),
                 p(T(r"Distance vector routing, the other algorithm, reaches the same distances once it has converged, but by asking neighbours rather than seeing the map.", r"另一种算法，距离向量路由，收敛之后得到的距离一样，只是靠问邻居，而不是看全图。")),
                 chapter=WIDER_CH()),
            number('try-c', T('Your turn: A to C', '你来：A 到 C'), SP,
                   T(r"In the same network, what is the shortest distance from A to C?", r"在同一个网络里，A 到 C 的最短距离是多少？"),
                   9, T(r"9, by two routes of equal length: A–B–C ($2 + 7$) and A–B–E–F–C ($2 + 2 + 2 + 3$).", r"9，有两条同样长的路：A–B–C（$2 + 7$）和 A–B–E–F–C（$2 + 2 + 2 + 3$）。"), tolerance=0, purpose='check', chapter=TRY_CH()),
            choice('try-g', T('Your turn: A to G', '你来：A 到 G'), SP,
                   T(r"What is the shortest path from A to G?", r"A 到 G 的最短路径是哪条？"),
                   [(T(r"A–B–E–G, length 5", r"A–B–E–G，长度 5"), True),
                    (T(r"A–G, length 6", r"A–G，长度 6"), T(r"A direct link is one hop, but not necessarily the shortest: through B and E it is $2 + 2 + 1 = 5$.", r"直连只有一跳，却不一定最短：经 B 和 E 是 $2 + 2 + 1 = 5$。"), 'direct-is-shortest')],
                   T(r"G's label starts at (6, via A) and is improved to (5, via E) when E becomes permanent.", r"G 的标号一开始是（6，经 A），E 成为永久节点时被改成（5，经 E）。")),
        ],
    )


def L_hard_satellite():
    SL, SW, BL, TW = '8zg9fk.sliding-window', '8zg9fk.stop-and-wait-arq', 'amu2b9.bandwidth-latency', '4952m9.tcp-window'
    return dict(
        id=f'{CID}-hard-satellite', title=T('A window over a satellite: throughput and sequence numbers', '卫星链路上的窗口：吞吐量与序号'),
        description=T('How long one round takes on a satellite link, how the window sets the throughput, how large a window keeps the link busy, and how many bits of sequence number Go-Back-N and Selective Repeat need for it.', '卫星链路上一轮要多久，窗口怎样决定吞吐量，多大的窗口能让链路一直忙，以及回退 N 帧和选择重传为此各需要几位序号。'),
        minutes=30,
        skills=skills(SL, SW, BL, TW),
        misconceptions=[{'id': 'one-way-delay', 'description': T('Waiting one propagation time for an acknowledgement instead of a round trip', '等确认时只算单程传播时间，而不是一个来回')}],
        steps=[
            read('problem', T('The problem, as printed', '题目原文'),
                 paper(PP(), T(r"Frames of 1000 bits are sent over a 1 Mbps channel using a geostationary satellite whose propagation time from the earth is 270 ms. Acknowledgements and headers are so short that their transmission time can be ignored.",
                               r"通过一颗地球同步卫星，在 1 Mbps 的信道上发送 1000 位的帧，从地面经卫星的传播时间为 270 ms。确认帧和首部都很短，它们的发送时间可以忽略。"),
                       T(r"(a) What is the maximum throughput with stop-and-wait? (b) With a sliding window of 7 frames? (c) How large must the window be to keep the channel fully busy, and how many bits of sequence number does that need with Go-Back-N and with Selective Repeat?",
                         r"(a) 用停等协议，最大吞吐量是多少？(b) 用 7 帧的滑动窗口呢？(c) 窗口要多大才能让信道一直满负荷？用回退 N 帧和选择重传，各需要几位序号？")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**1000-bit frames on a 1 Mbps channel**: putting one frame on the channel takes $1000 / 10^6$ s = 1 ms, the transmission time.", r"**1 Mbps 信道上的 1000 位帧**：把一帧放上信道要 $1000 / 10^6$ s = 1 ms，即发送时间。"),
                    T(r"**270 ms from the earth**: the time for a signal to go from one ground station, up to the satellite and down to the other. An acknowledgement needs the same time to come back.", r"**从地面出发 270 ms**：信号从一个地面站上到卫星、再下到另一个地面站所需的时间。确认回来也要同样的时间。"),
                    T(r"**Acknowledgements and headers ignored**: as on the course's stop-and-wait slide, the time to send an acknowledgement is taken as 0. Only the 1000-bit frames and the propagation count.", r"**忽略确认和首部**：和课件上停等协议那一页一样，发确认的时间记为 0。只算 1000 位的帧和传播时间。"),
                    T(r"**Throughput**: useful bits delivered per second, at most the channel's 1 Mbps.", r"**吞吐量**：每秒送达的有用位数，最多是信道的 1 Mbps。")),
                 chapter=Q_CH()),
            read('round', T('One round on a long link', '长链路上的一轮'),
                 p(T(r"A sender with a window of $W$ frames sends them, then must wait for an acknowledgement before it may send more. From its first bit, one **round** lasts the transmission time $T_f$, plus the propagation time $T_p$ for the frame to arrive, plus $T_p$ again for the acknowledgement to come back:",
                     r"窗口为 $W$ 帧的发送方把它们发出去，然后必须等到确认才能再发。从第一位发出算起，一**轮**的时间是发送时间 $T_f$，加上帧传到对面的传播时间 $T_p$，再加上确认传回来的 $T_p$：")),
                 math_(r'T = T_f + 2T_p'),
                 p(T(r"In that time it delivers $W$ frames, so the throughput is $W$ frames per round, up to the channel's own rate. On a satellite $T_p$ is huge compared with $T_f$, and the picture is mostly waiting:", r"这段时间里它送达 $W$ 帧，所以吞吐量是每轮 $W$ 帧，最多到信道本身的速率。在卫星上 $T_p$ 比 $T_f$ 大得多，画出来几乎全是在等：")),
                 svg(drawn(fig_pipe), T('One round of 541 ms as a bar: a sliver of 1 ms sending at the left, the rest, 540 ms, waiting for the acknowledgement.', '一轮 541 ms 画成一根条：最左边细细的 1 ms 在发送，其余 540 ms 都在等确认。'),
                     T(r"Stop-and-wait on the satellite: 1 ms of work in every 541.", r"卫星上的停等协议：每 541 ms 只干 1 ms 的活。")),
                 p(T(r"To keep the channel busy, the window must hold every frame that can be sent in one round, and then the sequence numbers must be large enough for that window. The limits are those of the sliding-window lesson: Go-Back-N at most $2^n - 1$, Selective Repeat at most $2^{n-1}$, with $n$-bit sequence numbers.",
                     r"要让信道一直忙，窗口得装下一轮之内能发出的全部帧；序号又得大到足够支持这个窗口。上限就是滑动窗口那一课讲的：序号 $n$ 位时，回退 N 帧最多 $2^n - 1$，选择重传最多 $2^{n-1}$。")),
                 chapter=IDEAS_CH()),
            derive('worked', T('The problem, worked', '这道题：完整解法'),
                   [(r'T_f = \frac{1000}{10^6}\ \text{s} = 1\ \text{ms},\qquad 2T_p = 540\ \text{ms}', T(r"Sending a frame takes 1 ms; the frame going and its acknowledgement coming back take 540 ms.", r"发一帧要 1 ms；帧过去、确认回来，共 540 ms。")),
                    (r'T = T_f + 2T_p = 541\ \text{ms}', T(r"From the first bit sent to the acknowledgement's arrival: one round.", r"从发出第一位到确认到达：一轮。")),
                    (r'\frac{1000\ \text{bits}}{0.541\ \text{s}} \approx 1850\ \text{bits/s}', T(r"(a) Stop-and-wait: one frame per round, about 1.85 kbps, 0.18% of the channel.", r"(a) 停等协议：每轮一帧，约 1.85 kbps，只用了信道的 0.18%。")),
                    (r'\frac{7 \times 1000\ \text{bits}}{0.541\ \text{s}} \approx 12\,900\ \text{bits/s}', T(r"(b) A window of 7: seven frames per round, about 12.9 kbps, still only 1.3% of the channel.", r"(b) 7 帧的窗口：每轮七帧，约 12.9 kbps，仍然只用了信道的 1.3%。")),
                    (r'W \ge \frac{T}{T_f} = 541', T(r"(c) To keep sending for the whole round, the window must hold as many frames as fit into it: 541.", r"(c) 要在整轮里一直发，窗口要装下一轮能发的全部帧：541 帧。")),
                    (r'2^n - 1 \ge 541 \;\Rightarrow\; n = 10', T(r"Go-Back-N allows a window of $2^n - 1$: $2^{10} - 1 = 1023$ is enough, $2^9 - 1 = 511$ is not.", r"回退 N 帧的窗口最多 $2^n - 1$：$2^{10} - 1 = 1023$ 够，$2^9 - 1 = 511$ 不够。")),
                    (r'2^{n-1} \ge 541 \;\Rightarrow\; n = 11', T(r"Selective Repeat allows $2^{n-1}$: $2^{10} = 1024$ is enough, so 11 bits.", r"选择重传的窗口最多 $2^{n-1}$：$2^{10} = 1024$ 够，所以 11 位。"))],
                   blank=(1, '541', T(r"One round is the transmission time plus the time for the frame to go and the acknowledgement to come back. How many ms?", r"一轮等于发送时间，加上帧过去和确认回来的时间。多少 ms？")),
                   skill=SL),
            read('answer', T('A full-mark answer', '一份满分答案'),
                 paper(PPA(),
                       T(r"Transmission time T_f = 1000 bits / 1 Mbps = 1 ms. A frame and its acknowledgement take 2 × 270 = 540 ms to go and come back (the acknowledgement's own transmission time is ignored), so one round takes 541 ms.", r"发送时间 T_f = 1000 位 / 1 Mbps = 1 ms。帧过去、确认回来要 2 × 270 = 540 ms（确认自身的发送时间忽略不计），所以一轮 541 ms。"),
                       T(r"(a) Stop-and-wait sends 1 frame per round: 1000 bits / 0.541 s ≈ 1.85 kbps (a utilisation of 1/541 ≈ 0.18%). (b) A window of 7: 7000 bits / 0.541 s ≈ 12.9 kbps (≈ 1.3%).", r"(a) 停等协议每轮发 1 帧：1000 位 / 0.541 s ≈ 1.85 kbps（利用率 1/541 ≈ 0.18%）。(b) 7 帧的窗口：7000 位 / 0.541 s ≈ 12.9 kbps（约 1.3%）。"),
                       T(r"(c) To keep the channel busy the window must cover a whole round: W ≥ 541 / 1 = 541 frames. Go-Back-N needs 2ⁿ − 1 ≥ 541, so n = 10 bits; Selective Repeat needs 2ⁿ⁻¹ ≥ 541, so n = 11 bits.", r"(c) 要让信道一直满，窗口要覆盖一整轮：W ≥ 541 / 1 = 541 帧。回退 N 帧要求 2ⁿ − 1 ≥ 541，所以 n = 10 位；选择重传要求 2ⁿ⁻¹ ≥ 541，所以 n = 11 位。"),
                       answer=True),
                 p(T(r"The usual slip is to wait only 270 ms for the acknowledgement: it has to come back too.", r"常见的错是等确认只算 270 ms：确认也要传回来。")),
                 chapter=PAPER_CH()),
            read('wider', T('The bandwidth-delay product, and TCP', '带宽时延积，以及 TCP'),
                 p(T(r"The window that fills a link is its **bandwidth-delay product**: the bandwidth times the round trip, the number of bits *in flight* when the link is full. Here $10^6 \times 0.541 \approx 541\,000$ bits, 541 frames. Any sliding-window protocol whose window is smaller than this leaves the link partly idle, however fast the link is.",
                     r"能填满一条链路的窗口，就是它的**带宽时延积**：带宽乘往返时间，即链路满载时*在路上*的位数。这里是 $10^6 \times 0.541 \approx 541\,000$ 位，541 帧。任何滑动窗口协议，只要窗口比它小，链路就有一部分时间闲着，无论链路多快。")),
                 p(T(r"TCP is limited the same way. Its window field has 16 bits, so without the window scale option (RFC 7323) a sender may have at most 65 535 bytes unacknowledged, and its throughput is at most the window divided by the round trip: over a 20 ms path, $65\,535 \times 8 / 0.02 \approx 26.2$ Mbps, whatever the link's speed. A 1 Gbps path with a 20 ms round trip has a bandwidth-delay product of 2.5 MB, which is why the window scale option exists.",
                     r"TCP 也受同样的限制。它的窗口字段只有 16 位，所以不用窗口扩大选项（RFC 7323）时，发送方最多只能有 65 535 字节未确认，吞吐量最多是窗口除以往返时间：在 20 ms 的路径上，是 $65\,535 \times 8 / 0.02 \approx 26.2$ Mbps，不管链路多快。往返 20 ms 的 1 Gbps 路径，带宽时延积是 2.5 MB，窗口扩大选项就是为此而设的。")),
                 chapter=WIDER_CH()),
            number('try-127', T('Your turn: a window of 127', '你来：127 帧的窗口'), SL,
                   T(r"On the same link, what is the throughput with a window of 127 frames, in kbps (to the nearest whole number)?", r"同一条链路，窗口为 127 帧时，吞吐量是多少 kbps（取整）？"),
                   235, T(r"$127\,000 / 0.541 \approx 235$ kbps: still under a quarter of the channel.", r"$127\,000 / 0.541 \approx 235$ kbps：仍不到信道的四分之一。"), tolerance=1, unit='kbps', purpose='check', chapter=TRY_CH()),
            choice('try-3bit', T('Your turn: 3-bit sequence numbers', '你来：3 位序号'), SL,
                   T(r"With 3-bit sequence numbers, which protocol gets more throughput over this satellite link?", r"序号只有 3 位时，在这条卫星链路上哪个协议的吞吐量更高？"),
                   [(T(r"Go-Back-N: its window can be 7, against 4 for Selective Repeat", r"回退 N 帧：它的窗口能到 7，选择重传只能到 4"), True),
                    (T(r"Selective Repeat: it never resends good frames", r"选择重传：它从不重发好帧"), T(r"With no errors there is nothing to resend; throughput is set by the window alone: 7 frames per round against 4.", r"没有出错时就没什么可重发；吞吐量只由窗口决定：每轮 7 帧对 4 帧。")),
                    (T(r"The same: both send one window per round", r"一样：两者每轮都发一窗"), T(r"Yes, one window per round, but the windows differ: $2^3 - 1 = 7$ against $2^{3-1} = 4$.", r"每轮确实都发一窗，但窗口大小不同：$2^3 - 1 = 7$ 对 $2^{3-1} = 4$。"))],
                   T(r"Without errors, the window decides: 7000 bits per round (12.9 kbps) against 4000 (7.4 kbps). Selective Repeat pays off only when errors are frequent.", r"不出错时，窗口说了算：每轮 7000 位（12.9 kbps）对 4000 位（7.4 kbps）。选择重传只有在错误频繁时才划算。")),
            number('try-tcp', T('Your turn: TCP over the satellite', '你来：卫星上的 TCP'), TW,
                   T(r"A TCP connection without window scaling (a window of at most 65 535 bytes) runs over the same satellite, with a round trip of 0.541 s. What is its maximum throughput, in Mbps (two decimals)?", r"一条不用窗口扩大选项的 TCP 连接（窗口最多 65 535 字节）跑在同一颗卫星上，往返 0.541 s。最大吞吐量是多少 Mbps（保留两位小数）？"),
                   0.97, T(r"$65\,535 \times 8 / 0.541 \approx 0.97$ Mbps: one full window per round trip, just under the 1 Mbps channel. On a faster satellite link, the 16-bit window field would be the limit.", r"$65\,535 \times 8 / 0.541 \approx 0.97$ Mbps：每个往返一整窗，刚好低于 1 Mbps 的信道。在更快的卫星链路上，16 位的窗口字段就成了瓶颈。"),
                   tolerance=0.01, unit='Mbps', purpose='check'),
        ],
    )


def L_hard_keys():
    RS, DS, DH = '3kgkap.rsa', '3kgkap.digital-signatures', '3kgkap.diffie-hellman-mitm'
    P1, P2 = T('Problem 1: RSA', '题 1：RSA'), T('Problem 2: Diffie–Hellman', '题 2：Diffie–Hellman')
    return dict(
        id=f'{CID}-hard-keys', title=T('Public-key arithmetic: RSA and Diffie–Hellman by hand', '公钥的算术：手算 RSA 和 Diffie–Hellman'),
        description=T('Making an RSA key pair, encrypting, decrypting and signing with small numbers; agreeing a Diffie–Hellman key; how to raise to a power modulo n by hand; and the man in the middle who breaks an unauthenticated exchange.', '用小数字生成 RSA 密钥对、加密、解密和签名；用 Diffie–Hellman 商定密钥；怎样手算模 n 的乘方；以及中间人怎样攻破不认证身份的密钥交换。'),
        minutes=40,
        skills=skills(RS, DS, DH),
        misconceptions=[{'id': 'sign-with-public', 'description': T('Signing with the public key, or verifying with the private key', '用公钥签名，或用私钥验证')}],
        steps=[
            read('p1', T('Problem 1, as printed', '题 1 原文'),
                 paper(PP(), T(r"In RSA, p = 3, q = 11 and d = 7.", r"在 RSA 中，p = 3，q = 11，d = 7。"),
                       T(r"(a) Find n, z and e, and give the public and the private key. (b) Encrypt the message M = 19, and decrypt the result to check it. (c) Bob signs the message 4 with his private key. What is the signature, and how does Alice check it?",
                         r"(a) 求 n、z 和 e，写出公钥和私钥。(b) 加密消息 M = 19，再把结果解密以验证。(c) Bob 用他的私钥给消息 4 签名。签名是多少？Alice 怎样验证？")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**p and q** are the two primes RSA starts from; real keys use primes hundreds of digits long, and the arithmetic is the same.", r"**p 和 q** 是 RSA 起步用的两个素数；真实的密钥用几百位长的素数，算法完全一样。"),
                    T(r"**n, z, e, d**: the numbers of the course's key generation, built below.", r"**n、z、e、d**：课上密钥生成步骤里的那几个数，下面从头讲。"),
                    T(r"**Signs with his private key**: the reverse use of the key pair, which proves who wrote a message instead of hiding it.", r"**用私钥签名**：反过来用这对密钥，作用不是隐藏消息，而是证明消息是谁写的。")),
                 chapter=P1),
            read('rsa', T('RSA, and powers modulo n by hand', 'RSA，以及手算模 n 的乘方'),
                 p(T(r"The course's key generation:", r"课上的密钥生成步骤：")),
                 ol(T(r"Choose two large primes $p$ and $q$; compute $n = p \times q$ and $z = (p-1)(q-1)$.", r"选两个大素数 $p$ 和 $q$；算出 $n = p \times q$ 和 $z = (p-1)(q-1)$。"),
                    T(r"Choose $d$ with no common factor with $z$.", r"选一个和 $z$ 没有公因数的 $d$。"),
                    T(r"Find $e$ such that $(d \times e) \bmod z = 1$.", r"找出满足 $(d \times e) \bmod z = 1$ 的 $e$。"),
                    T(r"The public key is $(e, n)$, the private key $(d, n)$.", r"公钥是 $(e, n)$，私钥是 $(d, n)$。")),
                 p(T(r"To encrypt, $C = M^e \bmod n$; to decrypt, $M = C^d \bmod n$. To sign, use the keys the other way round: the signature is $S = M^d \bmod n$, which only the owner of $d$ can make, and anyone checks that $S^e \bmod n = M$.",
                     r"加密：$C = M^e \bmod n$；解密：$M = C^d \bmod n$。签名时反过来用：签名 $S = M^d \bmod n$，只有持有 $d$ 的人做得出来；任何人都可以检验 $S^e \bmod n = M$。")),
                 p(T(r"By hand, never compute the whole power: reduce modulo $n$ after every multiplication, build high powers by squaring ($x^4 = (x^2)^2$), and use a negative remainder when it is smaller ($28 \equiv -5 \pmod{33}$). The numbers then stay small.",
                     r"手算时千万别把整个乘方算出来：每乘一次就对 $n$ 取模，高次幂用平方来搭（$x^4 = (x^2)^2$），余数用负数更小时就用负数（$28 \equiv -5 \pmod{33}$）。这样数字始终很小。"))),
            derive('p1-worked', T('Problem 1, worked', '题 1：完整解法'),
                   [(r'n = 3 \times 11 = 33,\qquad z = 2 \times 10 = 20', T(r"(a) The modulus and $z$.", r"(a) 模数和 $z$。")),
                    (r'7e \bmod 20 = 1 \;\Rightarrow\; e = 3', T(r"Try $e = 1, 2, 3, \ldots$: $7 \times 3 = 21$, and $21 \bmod 20 = 1$. Public key $(3, 33)$, private key $(7, 33)$.", r"依次试 $e = 1, 2, 3, \ldots$：$7 \times 3 = 21$，$21 \bmod 20 = 1$。公钥 $(3, 33)$，私钥 $(7, 33)$。")),
                    (r'19^2 = 361 \equiv 31 \pmod{33}', T(r"(b) Encrypt: $19^3$, one multiplication at a time. $361 - 330 = 31$.", r"(b) 加密：$19^3$，一次乘一下。$361 - 330 = 31$。")),
                    (r'C = 19^3 \equiv 31 \times 19 = 589 \equiv 28 \pmod{33}', T(r"$589 - 561 = 28$: the ciphertext.", r"$589 - 561 = 28$：密文。")),
                    (r'28 \equiv -5:\quad (-5)^2 = 25,\quad (-5)^4 = 625 \equiv 31 \equiv -2', T(r"Decrypt: $28^7$. Use $-5$ for 28, and build up the powers.", r"解密：$28^7$。用 $-5$ 代替 28，逐步搭出各次幂。")),
                    (r'(-5)^7 = (-5)^4 (-5)^2 (-5) \equiv (-2)(25)(-5) = 250 \equiv 19', T(r"$7 = 4 + 2 + 1$. $250 - 231 = 19$: the message is back.", r"$7 = 4 + 2 + 1$。$250 - 231 = 19$：消息回来了。")),
                    (r'S = 4^7:\quad 4^2 = 16,\quad 4^4 = 256 \equiv 25,\quad 25 \times 16 \times 4 = 1600 \equiv 16', T(r"(c) Bob signs with his private key $d = 7$. $1600 - 1584 = 16$: the signature.", r"(c) Bob 用私钥 $d = 7$ 签名。$1600 - 1584 = 16$：签名。")),
                    (r'16^3 = 4096 \equiv 4 \pmod{33}', T(r"Alice checks with Bob's public key $e = 3$: $4096 - 4092 = 4$, the message. Only Bob's private key could have produced 16.", r"Alice 用 Bob 的公钥 $e = 3$ 验证：$4096 - 4092 = 4$，正是原消息。只有 Bob 的私钥才算得出 16。"))],
                   blank=(3, '28', T(r"$19^2 \equiv 31$. What is $31 \times 19 \bmod 33$?", r"$19^2 \equiv 31$。$31 \times 19 \bmod 33$ 是多少？")),
                   skill=RS),
            read('p1-answer', T('Problem 1: a full-mark answer', '题 1：满分答案'),
                 p(T(r"Each part with its formula, the numbers put in, and the check that closes it: decryption returns 19, verification returns 4.", r"每一问写公式、代入数字，再用验算收尾：解密回到 19，验证回到 4。")),
                 paper(PPA(),
                       T(r"(a) n = p × q = 33; z = (p − 1)(q − 1) = 20. e must satisfy 7e mod 20 = 1, so e = 3 (21 mod 20 = 1). Public key (e, n) = (3, 33); private key (d, n) = (7, 33).", r"(a) n = p × q = 33；z = (p − 1)(q − 1) = 20。e 须满足 7e mod 20 = 1，所以 e = 3（21 mod 20 = 1）。公钥 (e, n) = (3, 33)；私钥 (d, n) = (7, 33)。"),
                       T(r"(b) C = 19³ mod 33 = 6859 mod 33 = 28. Check: 28⁷ mod 33 = 19, the original message.", r"(b) C = 19³ mod 33 = 6859 mod 33 = 28。验证：28⁷ mod 33 = 19，即原消息。"),
                       T(r"(c) Signature S = 4⁷ mod 33 = 16384 mod 33 = 16, computed with Bob's private key. Alice checks it with Bob's public key: 16³ mod 33 = 4096 mod 33 = 4, which equals the message, so it was signed by the holder of Bob's private key.", r"(c) 签名 S = 4⁷ mod 33 = 16384 mod 33 = 16，用 Bob 的私钥算出。Alice 用 Bob 的公钥验证：16³ mod 33 = 4096 mod 33 = 4，与消息相同，所以签名出自 Bob 私钥的持有者。"),
                       answer=True)),
            read('p2', T('Problem 2, as printed', '题 2 原文'),
                 paper(PP(), T(r"Alice and Bob use Diffie–Hellman key exchange with the public values n = 23 and g = 5. Alice chooses the secret x = 6, and Bob the secret y = 15.", r"Alice 和 Bob 用 Diffie–Hellman 密钥交换，公开值为 n = 23、g = 5。Alice 选择秘密 x = 6，Bob 选择秘密 y = 15。"),
                       T(r"(a) What does each send to the other, and what is the shared key? (b) Explain how Trudy can attack this exchange.", r"(a) 双方各发给对方什么？共享密钥是多少？(b) 说明 Trudy 怎样攻击这次交换。")),
                 h(T('Reading it slowly', '慢慢读一遍')),
                 ul(T(r"**Diffie–Hellman** lets two people who share no secret agree on one over a channel anyone can read.", r"**Diffie–Hellman** 让两个没有任何共同秘密的人，在谁都能看的信道上商定出一个秘密。"),
                    T(r"**n and g are public**: a prime and a base, known to everyone, Trudy included. **x and y are secret**: each side keeps its own.", r"**n 和 g 是公开的**：一个素数和一个底数，谁都知道，包括 Trudy。**x 和 y 是秘密的**：各自留着自己的。")),
                 chapter=P2),
            read('dh', T('A secret built in public', '在公开场合造出的秘密'),
                 p(T(r"Alice sends $g^x \bmod n$; Bob sends $g^y \bmod n$. Each then raises what it received to its own secret: Alice computes $(g^y)^x$ and Bob $(g^x)^y$, which are the same number, $g^{xy} \bmod n$. Trudy sees $n$, $g$, $g^x$ and $g^y$, but to get the key she would need $x$ or $y$, and recovering $x$ from $g^x \bmod n$ (the discrete logarithm) is infeasible when $n$ is large.",
                     r"Alice 发出 $g^x \bmod n$；Bob 发出 $g^y \bmod n$。然后各自把收到的数再乘方到自己的秘密次：Alice 算 $(g^y)^x$，Bob 算 $(g^x)^y$，两者是同一个数 $g^{xy} \bmod n$。Trudy 看得到 $n$、$g$、$g^x$ 和 $g^y$，可要得到密钥，她需要 $x$ 或 $y$，而 $n$ 很大时，从 $g^x \bmod n$ 反推出 $x$（离散对数）是做不到的。")),
                 svg(drawn(fig_dh), T('Alice with secret x = 6 and Bob with secret y = 15. Alice sends 5^6 mod 23 = 8; Bob sends 5^15 mod 23 = 19. Alice computes 19^6 mod 23 = 2, Bob computes 8^15 mod 23 = 2: the same key, never sent.',
                                      'Alice 的秘密 x = 6，Bob 的秘密 y = 15。Alice 发出 5^6 mod 23 = 8；Bob 发出 5^15 mod 23 = 19。Alice 算 19^6 mod 23 = 2，Bob 算 8^15 mod 23 = 2：同一把密钥，从没发出去过。'),
                     T(r"The problem's exchange: two public numbers cross, and the same key appears on both sides.", r"题目里的交换：两个公开的数交叉而过，两边出现同一把密钥。"))),
            derive('p2-worked', T('Problem 2 (a), worked', '题 2 (a)：完整解法'),
                   [(r'5^2 = 25 \equiv 2,\quad 5^4 \equiv 4,\quad 5^6 = 5^4 \cdot 5^2 \equiv 8 \pmod{23}', T(r"Alice sends $5^6 \bmod 23 = 8$.", r"Alice 发出 $5^6 \bmod 23 = 8$。")),
                    (r'5^8 \equiv 16,\quad 5^{15} = 5^8 \cdot 5^4 \cdot 5^2 \cdot 5 \equiv 16 \cdot 4 \cdot 2 \cdot 5 = 640 \equiv 19', T(r"Bob sends $5^{15} \bmod 23$: $15 = 8 + 4 + 2 + 1$, and $640 - 621 = 19$.", r"Bob 发出 $5^{15} \bmod 23$：$15 = 8 + 4 + 2 + 1$，$640 - 621 = 19$。")),
                    (r'19 \equiv -4:\quad (-4)^2 = 16,\quad (-4)^4 = 256 \equiv 3,\quad (-4)^6 \equiv 3 \cdot 16 = 48 \equiv 2', T(r"Alice computes $19^6 \bmod 23$, using $-4$ for 19.", r"Alice 算 $19^6 \bmod 23$，用 $-4$ 代替 19。")),
                    (r'K = 2', T(r"The shared key. Bob gets the same from $8^{15} \bmod 23$, since both equal $5^{90} \bmod 23$.", r"共享密钥。Bob 用 $8^{15} \bmod 23$ 也得到同样的数，因为两者都等于 $5^{90} \bmod 23$。"))],
                   blank=(3, '2', T(r"$(-4)^6 \equiv 48 \pmod{23}$. What is the key?", r"$(-4)^6 \equiv 48 \pmod{23}$。密钥是多少？")),
                   skill=DH),
            read('mitm', T('Part (b): the man in the middle', '第 (b) 问：中间人'),
                 p(T(r"Nothing in the exchange says *who* sent each number. Trudy, sitting between them, picks her own secret $z$, intercepts Alice's $g^x$ and sends Bob $g^z$ instead, and sends Alice $g^z$ in place of Bob's $g^y$. Alice now shares the key $g^{xz}$ with Trudy, and Bob shares $g^{yz}$ with Trudy, while each believes it is talking to the other. Trudy decrypts everything Alice sends, reads or changes it, re-encrypts it with Bob's key and passes it on.",
                     r"交换过程里没有任何东西说明每个数是*谁*发的。Trudy 夹在中间，选一个自己的秘密 $z$，截下 Alice 的 $g^x$，改发 $g^z$ 给 Bob；又把 Bob 的 $g^y$ 换成 $g^z$ 发给 Alice。于是 Alice 和 Trudy 共享密钥 $g^{xz}$，Bob 和 Trudy 共享 $g^{yz}$，而双方都以为自己在和对方说话。Trudy 解密 Alice 发的一切，读或改，再用和 Bob 的那把密钥加密，转发过去。")),
                 svg(drawn(fig_dh, True), T('Alice, Trudy and Bob. Alice sends g^x, Trudy sends g^z on to Bob; Bob sends g^y, Trudy sends g^z on to Alice. Alice and Bob each end up with a key shared with Trudy, who holds both.',
                                            'Alice、Trudy、Bob。Alice 发出 g^x，Trudy 转给 Bob 的是 g^z；Bob 发出 g^y，Trudy 转给 Alice 的是 g^z。Alice 和 Bob 各自得到一把和 Trudy 共享的密钥，Trudy 两把都有。'),
                     T(r"Two Diffie–Hellman exchanges instead of one, both with Trudy.", r"一次交换变成了两次，对面都是 Trudy。")),
                 p(T(r"The defence is to authenticate the exchange: each side signs the number it sends, or the public values come with certificates, so that a substituted number is detected.", r"防御办法是给交换加上认证：每一方给自己发的数签名，或者公开值附带证书，这样被替换的数就会被发现。")),
                 paper(PPA(),
                       T(r"(a) Alice sends g^x mod n = 5⁶ mod 23 = 8; Bob sends g^y mod n = 5¹⁵ mod 23 = 19. Alice computes 19⁶ mod 23 = 2 and Bob computes 8¹⁵ mod 23 = 2, so the shared key is 2.", r"(a) Alice 发送 g^x mod n = 5⁶ mod 23 = 8；Bob 发送 g^y mod n = 5¹⁵ mod 23 = 19。Alice 计算 19⁶ mod 23 = 2，Bob 计算 8¹⁵ mod 23 = 2，所以共享密钥是 2。"),
                       T(r"(b) Man-in-the-middle attack: the exchange is not authenticated, so Trudy can intercept both messages, choose her own secret z, and send g^z mod n to each side. Alice then shares a key with Trudy and Bob shares another key with Trudy; Trudy decrypts, reads or modifies, and re-encrypts all traffic between them without either noticing.",
                         r"(b) 中间人攻击：交换过程没有认证，所以 Trudy 可以截获双方的消息，选择自己的秘密 z，向两边各发送 g^z mod n。于是 Alice 和 Trudy 共享一把密钥，Bob 和 Trudy 共享另一把；Trudy 可以对双方之间的所有通信解密、读取或篡改、再加密，而双方都不会察觉。"),
                       answer=True)),
            read('wider', T('Signing a digest, and keys in practice', '对摘要签名，以及实际中的密钥'),
                 p(T(r"Public-key operations are slow, so in practice neither RSA nor Diffie–Hellman touches the data itself. A long message is signed through its **message digest**: a hash function such as SHA-256 turns it into a short fingerprint, and only the fingerprint is signed; the receiver hashes the message again and checks the signature on that. And a public-key exchange (RSA carrying a key, or Diffie–Hellman agreeing one) produces a **symmetric session key**, which then encrypts the data at full speed. That is how HTTPS and TLS work.",
                     r"公钥运算很慢，所以实际中 RSA 和 Diffie–Hellman 都不直接碰数据本身。长消息通过它的**消息摘要**来签名：SHA-256 之类的哈希函数把它变成一个短短的指纹，只对指纹签名；接收方把消息再哈希一遍，对这个结果验证签名。而公钥交换（用 RSA 运送一把密钥，或用 Diffie–Hellman 商定一把）产生的是一把**对称的会话密钥**，再由它全速加密数据。HTTPS 和 TLS 就是这样工作的。")),
                 chapter=WIDER_CH()),
            number('try-rsa', T('Your turn: encrypt 5', '你来：加密 5'), RS,
                   T(r"With the public key $(3, 33)$, encrypt the message $M = 5$.", r"用公钥 $(3, 33)$ 加密消息 $M = 5$。"),
                   26, T(r"$5^3 = 125$, and $125 - 99 = 26$. Check: $26^7 \bmod 33 = 5$.", r"$5^3 = 125$，$125 - 99 = 26$。验证：$26^7 \bmod 33 = 5$。"), tolerance=0, purpose='check', chapter=TRY_CH()),
            number('try-dh', T('Your turn: another key', '你来：另一把密钥'), DH,
                   T(r"With $n = 23$ and $g = 5$, Alice picks $x = 3$ and Bob picks $y = 4$. What is their shared key?", r"$n = 23$、$g = 5$，Alice 选 $x = 3$，Bob 选 $y = 4$。他们的共享密钥是多少？"),
                   18, T(r"Alice sends $5^3 \bmod 23 = 10$, Bob sends $5^4 \bmod 23 = 4$. Alice: $4^3 = 64 \equiv 18$; Bob: $10^4 = 10\,000 \equiv 18$.", r"Alice 发 $5^3 \bmod 23 = 10$，Bob 发 $5^4 \bmod 23 = 4$。Alice：$4^3 = 64 \equiv 18$；Bob：$10^4 = 10\,000 \equiv 18$。"), tolerance=0, purpose='check',
                   hints=[T(r"First find what each sends; then raise the other's number to your own secret.", r"先求出各自发什么；再把对方的数乘方到自己的秘密次。")]),
            choice('try-sign', T('Your turn: checking a signature', '你来：验证签名'), DS,
                   T(r"Alice receives a message and an RSA signature that claims to be Bob's. Which key does she check it with?", r"Alice 收到一条消息和一个声称是 Bob 的 RSA 签名。她用哪把钥匙验证？"),
                   [(T(r"Bob's public key", r"Bob 的公钥"), True),
                    (T(r"Bob's private key", r"Bob 的私钥"), T(r"Only Bob has it; that is why only Bob can sign.", r"只有 Bob 有它；正因如此，只有 Bob 能签名。"), 'sign-with-public'),
                    (T(r"Her own private key", r"她自己的私钥"), T(r"Her keys say nothing about who wrote the message.", r"她自己的钥匙说明不了消息是谁写的。"))],
                   T(r"The signature was made with Bob's private key; raising it to Bob's public exponent gives back the message, which anyone can check.", r"签名是用 Bob 的私钥做的；用 Bob 的公钥指数去乘方，就能还原出消息，谁都能验证。")),
        ],
    )


HARD_LESSONS = [mixed(f) for f in (L_hard_start, L_hard_codes, L_hard_ethernet, L_hard_fragments, L_hard_cidr, L_hard_dijkstra, L_hard_satellite, L_hard_keys)]
HARD_UNIT = T('Classic hard problems, worked', '常考难题精讲')
