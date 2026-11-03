# Lessons "clustering" (deck 17) and "semi" (deck 19) of the COMP90049 course (README.md here).
# Every number of every worked example is computed below, never typed by hand.
import itertools
import math

import numpy as np

from ml_kit import *  # noqa: F401,F403

CLUS, SEMI = 'clustering', 'semi'
PALETTE = [BLUE, ORANGE, GREEN, PURPLE, GOLD]


def fmt(x, nd=3):
    """A number as TeX text: trailing zeros dropped."""
    s = f'{x:.{nd}f}'.rstrip('0').rstrip('.') if nd else f'{x:.0f}'
    return s if s not in ('', '-0') else '0'


# ================================================================ clustering: computations
def lloyd(X, centres, max_iter=50):
    """k-means on a numpy array X from the given start centres; returns every (assignment, centres) state."""
    c = np.array(centres, float)
    states = []
    for _ in range(max_iter):
        d = ((X[:, None, :] - c[None, :, :]) ** 2).sum(-1)
        a = d.argmin(1)
        states.append((a.copy(), c.copy()))
        new = np.array([X[a == j].mean(0) if (a == j).any() else c[j] for j in range(len(c))])
        if np.allclose(new, c):
            break
        c = new
    return states


def wcss_of(X, a, k):
    return float(sum(((X[a == j] - X[a == j].mean(0)) ** 2).sum() for j in range(k) if (a == j).any()))


def km1d(X, c):
    """1-D k-means: the list of (assignment, centres) per round and the final WCSS."""
    states = lloyd(np.array(X, float).reshape(-1, 1), np.array(c, float).reshape(-1, 1))
    a, cc = states[-1]
    return states, wcss_of(np.array(X, float).reshape(-1, 1), a, len(c))


def bcss_of(X, a, k):
    mu = X.mean(0)
    return float(sum((a == j).sum() * ((X[a == j].mean(0) - mu) ** 2).sum() for j in range(k) if (a == j).any()))


def ch_index(X, a, k):
    n = len(X)
    return bcss_of(X, a, k) / wcss_of(X, a, k) * (n - k) / (k - 1)


# the deck's 5-instance distance matrix (slide 32)
DM = [[0, 15, 30, 5, 10], [15, 0, 35, 20, 25], [30, 35, 0, 50, 40], [5, 20, 50, 0, 45], [10, 25, 40, 45, 0]]


def agglo(D, how):
    """Agglomerative clustering on a distance matrix: [(height, members_a, members_b)], 0-based members."""
    cl = {i: [i] for i in range(len(D))}
    out = []
    while len(cl) > 1:
        best = None
        for a, b in itertools.combinations(sorted(cl), 2):
            ds = [D[i][j] for i in cl[a] for j in cl[b]]
            d = min(ds) if how == 'single' else max(ds) if how == 'complete' else sum(ds) / len(ds)
            if best is None or d < best[0]:
                best = (d, a, b)
        d, a, b = best
        out.append((d, sorted(cl[a]), sorted(cl[b])))
        cl[a] = cl[a] + cl[b]
        del cl[b]
    return out


def names(m):
    return ','.join(str(i + 1) for i in m)


def cluster_dist(D, a, b, how):
    ds = [D[i][j] for i in a for j in b]
    return min(ds) if how == 'single' else max(ds) if how == 'complete' else sum(ds) / len(ds)


def cut_clusters(n, merges, k):
    """The k clusters left after the first n-k merges."""
    cl = [[i] for i in range(n)]
    for d, a, b in merges[:n - k]:
        A = next(c for c in cl if a[0] in c)
        B = next(c for c in cl if b[0] in c)
        cl.remove(B)
        cl[cl.index(A)] = A + B
    return cl


MERGES = {h: agglo(DM, h) for h in ('single', 'complete', 'average')}


# ================================================================ clustering: data for the figures
def blobs3():
    rs = np.random.RandomState(7)
    cs = [(2.0, 2.2), (6.2, 2.6), (4.0, 6.4)]
    return np.vstack([rs.normal(c, 0.55, (14, 2)) for c in cs])


def rings():
    rs = np.random.RandomState(4)
    t = rs.uniform(0, 2 * math.pi, 60)
    inner = np.c_[np.cos(t[:30]), np.sin(t[:30])] * 1.0
    outer = np.c_[np.cos(t[30:]), np.sin(t[30:])] * 3.0
    return np.vstack([inner, outer]) + rs.normal(0, 0.08, (60, 2)), np.r_[np.zeros(30, int), np.ones(30, int)]


def elbow_values():
    X = blobs3()
    out = []
    for k in range(1, 9):
        best = None
        for seed in range(12):
            rs = np.random.RandomState(seed)
            st = lloyd(X, X[rs.choice(len(X), k, replace=False)])
            w = wcss_of(X, st[-1][0], k)
            best = w if best is None or w < best else best
        out.append(best)
    return out


ELBOW = elbow_values()

CH_X = np.array([0, 0.5, 1, 3, 4, 5], float).reshape(-1, 1)
CH_A = np.array([0, 0, 0, 1, 1, 1])
CH_B = np.array([0, 0, 1, 1, 2, 2])
CH_VALS = {}
for _nm, _a, _k in (('A', CH_A, 2), ('B', CH_B, 3)):
    CH_VALS[_nm] = dict(w=wcss_of(CH_X, _a, _k), b=bcss_of(CH_X, _a, _k), ch=ch_index(CH_X, _a, _k), k=_k)
assert abs(CH_VALS['A']['ch'] - 29.4) < 0.01 and abs(CH_VALS['B']['ch'] - 10.43) < 0.01  # the deck's numbers

# chaining example (figure): two compact groups joined by a thin strand of points
CHAIN = [(0.6, 1.2), (1.0, 1.9), (1.5, 1.3), (0.9, 1.5), (2.5, 1.55), (3.5, 1.45), (4.5, 1.55), (5.5, 1.5),
         (6.5, 1.3), (7.0, 1.9), (7.5, 1.4), (6.9, 1.5)]
_CD = [[math.dist(p, q) for q in CHAIN] for p in CHAIN]
CHAIN_SINGLE, CHAIN_COMPLETE = agglo(_CD, 'single'), agglo(_CD, 'complete')


# ================================================================ clustering: figures
def panel_axes(f, x, y, w, h, title):
    f.rect(x, y, w, h, fill='#ffffff', stroke=LINE, sw=1.2, rx=4)
    f.text(x + w / 2, y + 22, title, 16, MUTED, 'middle')


def scatter(f, X, labels, x, y, w, h, lo, hi, r=4.5, colors=PALETTE):
    sx = lambda v: x + 14 + (v - lo[0]) / (hi[0] - lo[0]) * (w - 28)  # noqa: E731
    sy = lambda v: y + h - 14 - (v - lo[1]) / (hi[1] - lo[1]) * (h - 56)  # noqa: E731
    for (px, py), l in zip(X, labels):
        f.circle(sx(px), sy(py), r, fill=colors[int(l) % len(colors)], stroke='#ffffff', sw=1)
    return sx, sy


def fig_kmeans_steps(lang):
    X = blobs3()
    st = lloyd(X, [X[0], X[1], X[2]])  # three starts in the same blob: a slow, visible run
    picks = [0, 1, len(st) - 1]
    f = Fig(780, 300, lang)
    titles = [f.L('start', '初始'), f.L('after step 1', '第 1 轮后'), f.L('converged', '收敛')]
    for i, (idx, t) in enumerate(zip(picks, titles)):
        x0 = 10 + i * 256
        panel_axes(f, x0, 8, 246, 284, t)
        a, c = st[idx]
        sx, sy = scatter(f, X, a if idx else np.full(len(X), 4), x0, 8, 246, 284, (0, 0), (8, 8), colors=PALETTE if idx else ['#cfd3d9'] * 5)
        for j, cc in enumerate(c):
            f.cross(sx(cc[0]), sy(cc[1]), 9, INK)
            f.text(sx(cc[0]) + 12, sy(cc[1]) - 8, f'μ_{{{j + 1}}}', 16, INK)
    return f.svg()


def fig_rings(lang):
    X, truth = rings()
    st = lloyd(X, [X[0], X[40]])
    a = st[-1][0]
    f = Fig(700, 320, lang)
    for i, (labels, t) in enumerate(((truth, f.L('what we want', '想要的')), (a, f.L('k-means, K = 2', 'k-means，K = 2')))):
        x0 = 10 + i * 345
        panel_axes(f, x0, 8, 335, 304, t)
        scatter(f, X, labels, x0, 8, 335, 304, (-3.4, -3.4), (3.4, 3.4), colors=[BLUE, ORANGE])
    return f.svg()


def fig_elbow(lang):
    pl = Plot(0.5, 8.5, 0, max(ELBOW) * 1.08)
    pl.axes('K', 'WCSS', xticks=range(1, 9), yticks=[])
    for k in range(1, 8):
        pl.seg((k, ELBOW[k - 1]), (k + 1, ELBOW[k]), BLUE, 3)
    for k, w in enumerate(ELBOW, 1):
        pl.dot(k, w, ORANGE if k == 3 else BLUE, 6 if k == 3 else 5)
    pl.text(3, ELBOW[2], 'elbow' if lang == 'en' else '拐点', ORANGE, 17, 'start', 12, -12)
    return pl.svg()


def dendro_panel(f, merges, x0, y0, w, h, ymax, title):
    """One dendrogram of `merges` in the box (x0, y0, w, h); heights 0..ymax."""
    n = len(merges) + 1
    kids = {}
    nodes = {i: ((i,), 0.0) for i in range(n)}
    clusters = [(i,) for i in range(n)]
    tree = []
    for d, a, b in merges:
        A = next(c for c in clusters if a[0] in c)
        B = next(c for c in clusters if b[0] in c)
        clusters.remove(A)
        clusters.remove(B)
        new = A + B
        clusters.append(new)
        tree.append((A, B, new, d))
        kids[new] = (A, B)
    order = list(tree[-1][2]) if tree else list(range(n))
    # leaf order: recursive so that children stay adjacent
    def leaves(node):
        return list(node) if node not in kids else leaves(kids[node][0]) + leaves(kids[node][1])
    order = leaves(tree[-1][2])
    left, right, top, bottom = x0 + 16, x0 + w - 16, y0 + 40, y0 + h - 34
    px = {(leaf,): left + (i + 0.5) * (right - left) / n for i, leaf in enumerate(order)}
    py = lambda v: bottom - v / ymax * (bottom - top)  # noqa: E731
    height = {(i,): 0.0 for i in range(n)}
    f.text(x0 + w / 2, y0 + 22, title, 16, MUTED, 'middle')
    for A, B, new, d in tree:
        xa, xb = px[A], px[B]
        px[new] = (xa + xb) / 2
        height[new] = d
        f.line(xa, py(height[A]), xa, py(d), INK, 2)
        f.line(xb, py(height[B]), xb, py(d), INK, 2)
        f.line(xa, py(d), xb, py(d), INK, 2)
        f.text(px[new] + 6, py(d) - 5, fmt(d, 1), 14, ORANGE)
    for leaf in order:
        f.text(px[(leaf,)], bottom + 22, str(leaf + 1), 16, INK, 'middle')


def fig_dendrograms(lang):
    f = Fig(780, 300, lang)
    for i, h in enumerate(('single', 'complete', 'average')):
        title = {'single': f.L('single', '单链'), 'complete': f.L('complete', '全链'), 'average': f.L('average', '平均链')}[h]
        dendro_panel(f, MERGES[h], 10 + i * 258, 4, 250, 290, 55, title)
    return f.svg()


def fig_chain(lang):
    f = Fig(720, 300, lang)
    for i, (m, t) in enumerate(((CHAIN_SINGLE, f.L('single link, K = 2', '单链，K = 2')), (CHAIN_COMPLETE, f.L('complete link, K = 2', '全链，K = 2')))):
        x0 = 8 + i * 356
        panel_axes(f, x0, 6, 348, 288, t)
        cl = cut_clusters(len(CHAIN), m, 2)
        lab = np.zeros(len(CHAIN), int)
        for j, c in enumerate(cl):
            for p in c:
                lab[p] = j
        sx, sy = scatter(f, np.array(CHAIN), lab, x0, 6, 348, 288, (0, 0.5), (8, 2.6), r=7, colors=[BLUE, ORANGE])
        f.text(sx(1.1), sy(0.85), 'A', 17, MUTED, 'middle')
        f.text(sx(6.9), sy(0.85), 'B', 17, MUTED, 'middle')
        f.text(sx(4.0), sy(0.85), f.L('strand', '细链'), 17, MUTED, 'middle')
    return f.svg()


# ================================================================ clustering: worked traces generated from the data
def matrix_tex(clusters, how, D=DM):
    """The current cluster distance matrix as a TeX array (clusters are lists of 0-based instance numbers)."""
    labs = [r'\{' + names(c) + r'\}' if len(c) > 1 else names(c) for c in clusters]
    rows = []
    for i, a in enumerate(clusters):
        cells = ['-' if i == j else fmt(cluster_dist(D, a, b, how), 2) for j, b in enumerate(clusters)]
        rows.append(labs[i] + ' & ' + ' & '.join(cells))
    return r'\begin{array}{c|' + 'c' * len(clusters) + '}' + ' & ' + ' & '.join(labs) + r'\\ \hline ' + r' \\ '.join(rows) + r'\end{array}'


def state_before(how, step):
    cl = [[i] for i in range(5)]
    for d, a, b in MERGES[how][:step]:
        A = next(c for c in cl if a[0] in c)
        B = next(c for c in cl if b[0] in c)
        cl.remove(B)
        cl[cl.index(A)] = A + B
    return cl


def update_tex(how):
    """The new entries after the first merge ({1,4}), written as the rule the linkage uses."""
    fn = {'single': r'\min', 'complete': r'\max', 'average': r'\text{mean}'}[how]
    rows = []
    for j in (1, 2, 4):
        a, b = DM[0][j], DM[3][j]
        val = cluster_dist(DM, [0, 3], [j], how)
        rows.append(rf'd(\{{1,4\}},{j + 1}) &= {fn}({a},{b}) = {fmt(val, 2)}' if how != 'average' else
                    rf'd(\{{1,4\}},{j + 1}) &= \tfrac{{{a}+{b}}}{{2}} = {fmt(val, 2)}')
    return r'\begin{aligned}' + r' \\ '.join(rows) + r'\end{aligned}'


def trace_lines(how):
    lines = []
    M = MERGES[how]
    for s, (d, a, b) in enumerate(M):
        cl = state_before(how, s)
        A, B = names(a), names(b)
        if s == 0:
            lines.append((matrix_tex(cl, how),
                          T(rf"The matrix of distances between the 5 instances (the numbers are distances, not coordinates). The smallest off-diagonal entry is {fmt(d)}, between instances {A} and {B}. This first step is the same for every linkage: merge them, at height {fmt(d)}.",
                            rf"5 个实例两两之间的距离矩阵（里面是距离，不是坐标）。除对角线外最小的数是 {fmt(d)}，在实例 {A} 和 {B} 之间。这一步对所有链接方式都一样：把它们合并，高度为 {fmt(d)}。")))
            how_say = {'single': (r"Single linkage: the distance between two clusters is the **smallest** distance between a member of one and a member of the other. So each new entry is the min of the two old entries.",
                                  r"单链（single linkage）：两个簇之间的距离取两簇成员之间**最小**的那个距离。所以每个新数就是两个旧数里较小的。"),
                       'complete': (r"Complete linkage: the distance between two clusters is the **largest** distance between a member of one and a member of the other. Each new entry is the max of the two old entries.",
                                    r"全链（complete linkage）：两个簇之间的距离取两簇成员之间**最大**的那个距离。每个新数就是两个旧数里较大的。"),
                       'average': (r"Average linkage: the distance between two clusters is the **mean** of all pairwise distances between their members. Here every pair involves one member of {1,4}, so each new entry is the mean of two old entries (in general, weight by cluster sizes).",
                                   r"平均链（average linkage）：两个簇之间的距离取两簇成员所有配对距离的**平均**。这里每对里都有 {1,4} 的一个成员，所以新数是两个旧数的平均（一般情况下要按簇的大小加权）。")}[how]
            lines.append((update_tex(how), T(*how_say)))
        else:
            if s == len(M) - 1:
                say = T(rf"Two clusters left, {{{A}}} and {{{B}}}, at distance {fmt(d, 2)}. The last merge puts everything into one cluster at height {fmt(d, 2)}.",
                        rf"只剩两个簇 {{{A}}} 和 {{{B}}}，距离 {fmt(d, 2)}。最后一次合并把所有实例并成一个簇，高度 {fmt(d, 2)}。")
            else:
                say = T(rf"Smallest entry now: {fmt(d, 2)}, between {{{A}}} and {{{B}}}. Merge them at height {fmt(d, 2)}, and recompute that cluster's row with the same rule.",
                        rf"现在最小的数是 {fmt(d, 2)}，在 {{{A}}} 和 {{{B}}} 之间。在高度 {fmt(d, 2)} 把它们合并，再用同一条规则重算这个簇的那一行。")
            lines.append((matrix_tex(cl, how), say))
    heights = ', '.join(fmt(d, 2) for d, _, _ in M)
    seq = r' \to '.join(r'\{' + names(sorted(a + b)) + r'\}' for d, a, b in M)
    lines.append((seq, T(rf"The merge sequence, in order. The heights are {heights}; those are the heights of the dendrogram's horizontal bars.",
                                              rf"合并顺序如上。各次合并的高度依次为 {heights}，它们就是树状图（dendrogram）里横线的高度。")))
    return lines


# ================================================================ clustering: the lesson
def L_clustering():
    S, KM, HC, EV = f'{CLUS}.what', f'{CLUS}.kmeans', f'{CLUS}.hier', f'{CLUS}.eval'
    X1 = [1, 2, 4, 8, 9, 11]
    states1, w1 = km1d(X1, [1, 2])
    XL = [0, 1, 5, 6, 11, 12]
    _, w_bad = km1d(XL, [0, 1, 5])
    _, w_good = km1d(XL, [0, 5, 11])
    st_bad = km1d(XL, [0, 1, 5])[0][-1]
    cA, cB = CH_VALS['A'], CH_VALS['B']
    tss = float(((CH_X - CH_X.mean()) ** 2).sum())
    n = len(X1)

    # the 1-D worked k-means as derive lines
    km_lines = []
    Xa = np.array(X1, float)
    for r, (a, c) in enumerate(states1):
        cs = ', '.join(fmt(v) for v in c.ravel())
        groups = ' \\mid '.join('\\{' + ','.join(fmt(v) for v in Xa[a == j]) + '\\}' for j in range(2))
        newc = [Xa[a == j].mean() for j in range(2)]
        ws = wcss_of(Xa.reshape(-1, 1), a, 2)
        if r == 0:
            say = T(rf"Start: K = 2, and the two seeds are instances 1 and 2, so $\mu = ({cs})$. **Assign** every point to its nearest centroid.",
                    rf"开始：K = 2，两个种子取 1 和 2，即 $\mu = ({cs})$。**分配**：每个点归到最近的质心。")
        else:
            say = T(rf"Round {r + 1}: centroids $({cs})$. Assign each point to the nearer one (4 is {fmt(abs(4 - c[0, 0]))} from $\mu_1$ and {fmt(abs(4 - c[1, 0]))} from $\mu_2$ in this round).",
                    rf"第 {r + 1} 轮：质心 $({cs})$。每个点归到更近的一个（这一轮里 4 离 $\mu_1$ 是 {fmt(abs(4 - c[0, 0]))}，离 $\mu_2$ 是 {fmt(abs(4 - c[1, 0]))}）。")
        km_lines.append((groups, say))
        nm = ', '.join(fmt(v) for v in newc)
        stable = np.allclose(newc, c.ravel())
        km_lines.append((rf'\mu \leftarrow ({nm}), \quad \text{{WCSS}} = {fmt(ws, 2)}',
                         T(rf"**Update**: each centroid becomes the mean of its points. The WCSS (sum of squared distances to the own centroid) is {fmt(ws, 2)}." + (" The centroids did not move: stop." if stable else ""),
                           rf"**更新**：每个质心变成自己那组点的均值。WCSS（每个点到自己质心的距离平方之和）是 {fmt(ws, 2)}。" + ("质心没有动：停止。" if stable else ""))))

    # the mean minimises the sum of squares
    pts = [2, 4, 9]
    mean = sum(pts) / 3
    f5 = sum((x - mean) ** 2 for x in pts)
    f4 = sum((x - 4) ** 2 for x in pts)

    return dict(
        id=lid(CLUS), title=T('Clustering: k-means, hierarchical, and how to judge a clustering', '聚类：k-means、层次聚类，以及怎么评价聚类'),
        description=T('What clustering is for, k-means as coordinate descent on WCSS, agglomerative clustering with single, complete and average linkage by hand, and the WCSS, BCSS and Calinski-Harabasz measures.',
                      '聚类是做什么的，k-means 作为对 WCSS 的坐标下降，用单链、全链、平均链手算层次聚类，以及 WCSS、BCSS 和 Calinski-Harabasz 指标。'),
        minutes=45,
        skills=[{'id': S, 'name': T('Unsupervised learning and kinds of clustering', '无监督学习与聚类的种类')},
                {'id': KM, 'name': T('k-means: algorithm, convergence, limits, choosing K', 'k-means：算法、收敛、局限、选 K')},
                {'id': HC, 'name': T('Agglomerative clustering and linkages', '凝聚层次聚类与各种链接')},
                {'id': EV, 'name': T('Cluster evaluation: WCSS, BCSS, CH index', '聚类评价：WCSS、BCSS、CH 指数')}],
        misconceptions=[
            {'id': 'wcss-pick-k', 'description': T('Choosing K by minimising WCSS (it always falls as K grows, down to 0 at K = N)', '用最小化 WCSS 来选 K（K 越大它越小，K = N 时为 0）')},
            {'id': 'global-opt', 'description': T('Believing k-means always finds the best clustering', '以为 k-means 一定能找到最好的聚类')},
            {'id': 'linkage-swap', 'description': T('Mixing up single (min) and complete (max) linkage', '把单链（取最小）和全链（取最大）弄反')},
            {'id': 'centroid-coords', 'description': T('Reading the distance matrix entries as coordinates', '把距离矩阵里的数当成坐标')},
            {'id': 'ch-direction', 'description': T('Reading a low CH index as better (higher is better)', '以为 CH 指数小的更好（越大越好）')}],
        steps=[
            # ---------------------------------------------------------------- what and kinds
            read('what', T('Clustering: structure from data alone', '聚类：只凭数据找结构'),
                 p(T(r"Labelling is slow and costly (a person usually has to do it), so labelled data is scarce while unlabelled data is everywhere. **Unsupervised learning** works with instances $\mathbf{x}$ only, with no labels $y$. The deck lists four kinds of task:",
                     r"打标签又慢又贵（通常要人来做），所以有标签的数据很少，没标签的数据到处都是。**无监督学习**（unsupervised learning）只有实例 $\mathbf{x}$，没有标签 $y$。课件列了四类任务：")),
                 table([T('Task', '任务'), T('What it finds', '找什么')],
                       [T('PCA', 'PCA'), T('a few directions that keep the most information of many features', '用少数几个方向保留多个特征里最多的信息')],
                       [T('Clustering', '聚类'), T('groups of similar items', '相似的实例成组')],
                       [T('Anomaly detection', '异常检测'), T('rare items that differ from the pattern', '和常规模式不同的罕见实例')],
                       [T('Association rule mining', '关联规则挖掘'), T('rules that predict one item in a transaction from others', '根据交易里的某些商品预测另一些商品出现的规则')]),
                 p(T(r"This lesson is about **clustering**: put similar instances in the same group and dissimilar ones in different groups. Nobody tells us how many groups there are or what they mean; we learn the structure from the data alone, so every clustering carries assumptions about what kind of structure to expect. Unsupervised results are hard to judge: they make only as much sense as you can make out of them. That is why the last chapter is about how to evaluate a clustering.",
                     r"这一课讲**聚类**（clustering）：相似的实例放进同一组，不相似的放进不同的组。没人告诉我们有几组、每组是什么意思；结构只能从数据里学出来，所以每种聚类都带着对“结构长什么样”的假设。无监督的结果很难评判：你能从中读出多少意义，它就只有多少意义。所以最后一章专讲怎样评价聚类。")),
                 p(T(r"The deck sorts clustering by five yes/no questions about the structure we expect:", r"课件用五个是非问题，按我们期望的结构给聚类分类：")),
                 table([T('Question', '问题'), T('One side', '一边'), T('Other side', '另一边')],
                       [T('Can an item be in more than one cluster?', '一个实例能属于多个簇吗？'), T('**Exclusive**: exactly one', '**互斥**（exclusive）：只属于一个'), T('**Overlapping**: several allowed', '**重叠**（overlapping）：可以属于多个')],
                       [T('Can an item be only partly in a cluster?', '实例能“部分”属于一个簇吗？'), T('**Deterministic** (hard): in or out', '**确定性**（硬聚类）：在或不在'), T('**Probabilistic** (soft): e.g. (0.51, 0.49)', '**概率性**（软聚类）：如 (0.51, 0.49)')],
                       [T('Are clusters nested (a tree)?', '簇之间有嵌套（树）关系吗？'), T('**Hierarchical**: subsets form a tree', '**层次**：子集构成一棵树'), T('**Partitioning**: one flat split', '**划分**（partitioning）：一刀平面切分')],
                       [T('Must every item be clustered?', '每个实例都要被聚类吗？'), T('**Complete**: all items', '**完全**（complete）：所有实例'), T('**Partial**: only some', '**部分**（partial）：只聚一部分')],
                       [T('Are cluster sizes, shapes and densities alike?', '簇的大小、形状、密度相近吗？'), T('**Homogeneous**: alike', '**同质**（homogeneous）：相近'), T('**Heterogeneous**: widely different', '**异质**（heterogeneous）：差别很大')]),
                 p(T(r"The two methods of this lesson, k-means and agglomerative clustering, are both **exclusive, deterministic and complete**. They differ on one axis: k-means is **partitioning**, agglomerative is **hierarchical**.",
                     r"这一课的两个方法，k-means 和凝聚聚类，都是**互斥、确定性、完全**的。区别在一条轴上：k-means 是**划分**式，凝聚聚类是**层次**式。")),
                 quiz(T('A soft clustering gives a customer the memberships (0.7, 0.3). Which description fits?', '软聚类给某个顾客的隶属度是 (0.7, 0.3)。哪个描述对？'),
                      [(T('Deterministic: the customer is in cluster 1 because 0.7 is larger', '确定性：0.7 更大，所以属于簇 1'), T('Deterministic (hard) clustering outputs a single cluster, not a membership vector; picking the larger one afterwards hardens a soft result.', '确定性（硬）聚类只给出一个簇，而不是隶属度向量；事后取较大者，是把软结果硬化。')),
                       (T('Probabilistic (soft): the customer is partly in each cluster', '概率性（软）：顾客部分属于每个簇'), True),
                       (T('Overlapping: the customer fully belongs to both clusters', '重叠：顾客完全属于两个簇'), T('Overlapping means in or out for each cluster, possibly both; 0.7 / 0.3 are degrees of membership, a different axis.', '重叠指对每个簇是“在或不在”，可以同时在两个簇里；0.7 / 0.3 是隶属程度，是另一条轴。'))],
                      T('Soft clustering returns a degree of membership per cluster; k-means and agglomerative clustering never do.', '软聚类对每个簇给出一个隶属程度；k-means 和凝聚聚类都不会这样。')),
                 chapter=T('What clustering is', '聚类是什么')),
            # ---------------------------------------------------------------- k-means
            read('kmeans', T('k-means: K centroids, assign, move, repeat', 'k-means：K 个质心，分配、移动、重复'),
                 p(T(r"Idea: represent each cluster by its centre (its **centroid**, the mean of its points) and let every instance belong to the nearest centre. Centres and memberships depend on each other, so we alternate.",
                     r"想法：用中心（**质心** centroid，即簇内点的均值）代表每个簇，让每个实例属于最近的中心。中心和归属互相依赖，所以交替求解。")),
                 ol(T(r"Ask for $K$, the number of clusters, and pick $K$ points at random as the starting centroids (the seeds).", r"先指定 $K$（簇的个数），随机挑 $K$ 个点作为起始质心（种子）。"),
                    T(r"**Assign** each instance to the cluster with the nearest centroid.", r"**分配**：每个实例归到质心最近的簇。"),
                    T(r"**Update**: recompute each centroid as the mean of the instances now in its cluster.", r"**更新**：把每个质心重算为当前簇内实例的均值。"),
                    T(r"Repeat 2 and 3 until the centroids stop changing (or move less than a threshold, or very few points change cluster).", r"重复 2、3，直到质心不再变化（或变化小于阈值，或几乎没有点换簇）。")),
                 svg(drawn(fig_kmeans_steps), T('Three panels of 2-D points: the start with three grey point sets and three centroid crosses, the state after one step with points coloured, and the converged clusters.',
                                                  '三幅二维散点图：起始时点是灰色、有三个质心叉号；第 1 轮后点按簇着色；最后是收敛的聚类。'),
                     T(r"Seeds start inside one blob; the centroids ($\times$) walk to the three groups.", r"种子一开始都落在同一团里，质心（$\times$）一步步走到三个组的中心。")),
                 callout('note', T('Scale first', '先缩放'), T(r"k-means (like k-NN) is distance based, so features on large scales dominate. Normalise each attribute, for example into $[0,1]$, before clustering. And the mean must make sense: it is ill-defined for categorical attributes.",
                                                              r"k-means（和 k-NN 一样）基于距离，数值范围大的特征会主导结果。聚类前先把每个属性规范化，例如缩放到 $[0,1]$。另外均值必须有意义：它对类别型属性没有定义。")),
                 p(T(r"k-means is exclusive, complete and partitioning, and it aims at **compact, spherical** clusters. Strengths from the deck: simple, fast and scalable to large datasets, easy to interpret and visualise, widely applicable, and good when clusters are round and well separated.",
                     r"k-means 是互斥、完全、划分式的，目标是**紧凑的球形**簇。课件列的优点：简单，快，能扩展到大数据集，结果易解释、易可视化，适用面广，簇是圆形且分得开时效果好。")),
                 chapter=T('k-means', 'k-means')),
            derive('km-hand', T('k-means by hand on six numbers', '六个数上手算 k-means'), km_lines,
                   intro=T(r"One-dimensional data: $x = 1, 2, 4, 8, 9, 11$, with $K = 2$ and the seeds 1 and 2. The exam would ask you to run exactly this.",
                           r"一维数据：$x = 1, 2, 4, 8, 9, 11$，$K = 2$，种子取 1 和 2。考试就会让你这样走一遍。"),
                   outro=T(rf"**Result:** clusters {{1, 2, 4}} and {{8, 9, 11}}, centroids {fmt(np.mean([1, 2, 4]))} and {fmt(np.mean([8, 9, 11]))}, WCSS {fmt(w1, 2)}. Look at the WCSS column: it went down every round and never up. The next chapter shows why.",
                           rf"**结果：** 簇 {{1, 2, 4}} 和 {{8, 9, 11}}，质心 {fmt(np.mean([1, 2, 4]))} 和 {fmt(np.mean([8, 9, 11]))}，WCSS {fmt(w1, 2)}。看每轮的 WCSS：一直在降，从不上升。下一章解释为什么。"),
                   skill=KM),
            read('limits', T('What k-means cannot do', 'k-means 做不到的事'),
                 table([T('Limitation (deck)', '局限（课件）'), T('Why it happens', '原因')],
                       [T('K must be given', '必须事先给定 K'), T('the algorithm has no way to decide it (next page)', '算法本身没办法决定 K（下一页）')],
                       [T('Sensitive to initial centroids', '对初始质心敏感'), T('different seeds can end in different, worse solutions: a local optimum', '种子不同可能收敛到不同的、更差的解：局部最优')],
                       [T('Sensitive to outliers', '对离群点敏感'), T('a mean is dragged by extreme points, so a centroid can be pulled off its cluster', '均值会被极端点拖走，质心可能偏离簇')],
                       [T('Non-spherical clusters', '非球形的簇'), T('it assigns by distance to a centre, so boundaries between clusters are straight lines', '按到中心的距离分配，所以簇之间的边界是直线')],
                       [T('Clusters of different sizes', '大小不同的簇'), T('a big cluster has points far from its centre; some are closer to a small neighbour, so the boundary cuts the big one', '大簇里有些点离自己的中心很远，反而离小邻居更近，边界就把大簇切掉一块')],
                       [T('Clusters of different densities', '密度不同的簇'), T('the same reason: assignment uses distance only, not how densely the points sit', '同一个原因：分配只看距离，不看点有多密')],
                       [T('Mean undefined for categorical data', '类别型属性没有均值'), T('no mean of colours or words', '颜色、单词没法求平均')]),
                 svg(drawn(fig_rings), T('Left: two concentric rings, one blue and one orange, the desired clusters. Right: the k-means result with K = 2, where each colour is a half-plane of both rings.',
                                         '左：两个同心圆环，蓝、橙分别是想要的簇。右：K = 2 时 k-means 的结果，每种颜色都是穿过两个圆环的半个平面。'),
                     T(r"Both rings have the same centre, so every centroid sits near the middle; the cut is a straight line.", r"两个圆环中心相同，所以不管怎么放质心，切出来的都是一条直线。")),
                 quiz(T('Which dataset is k-means worst suited to?', 'k-means 最不适合哪种数据？'),
                      [(T('Three round, well-separated groups of similar size', '三个圆形、分得开、大小相近的组'), T('This is the case k-means was made for.', '这正是 k-means 设计时针对的情形。')),
                       (T('Two ring-shaped groups, one inside the other', '两个一个套一个的环形组'), True),
                       (T('Two groups of 50 points each, far apart', '两个各 50 个点、相距很远的组'), T('Compact and well separated: k-means is fine.', '紧凑且分得开：k-means 没问题。'))],
                      T('Rings are not "round blobs around a centre": the nearest-centroid rule can only draw straight boundaries.', '环不是“围着中心的圆团”：最近质心规则只能画直线边界。'))),
            read('choosek', T('Choosing K: the elbow method', '选 K：肘部法'),
                 p(T(r"k-means needs $K$ in advance, and the data rarely says how many groups there are. The **elbow method**: run k-means for a range of $K$, compute a quality measure for each (the usual one is the WCSS, defined in the last chapter), plot it against $K$, and look for the point after which the drop slows down sharply.",
                     r"k-means 要事先给定 $K$，而数据很少直接告诉你有几组。**肘部法**（elbow method）：对一系列 $K$ 都跑一次 k-means，算出质量指标（常用 WCSS，最后一章定义），把它对 $K$ 画出来，找出之后下降明显变缓的那一点。")),
                 svg(drawn(fig_elbow), T('WCSS against K from 1 to 8 for three blobs of data: a steep fall until K = 3, marked as the elbow, then a nearly flat tail.', '对三团数据，K 从 1 到 8 的 WCSS：到 K = 3 之前陡降，K = 3 标为拐点，之后几乎持平。'),
                     T(r"Adding a cluster beyond the elbow only splits clusters that were already tight.", r"超过拐点再加簇，只是把本来就紧凑的簇劈开。")),
                 callout('warning', T('Why not simply pick the K with the lowest WCSS?', '为什么不直接选 WCSS 最小的 K？'),
                         T(r"WCSS never goes up as $K$ grows, and at $K = N$ every point is its own cluster with WCSS $= 0$. So the minimum is always the useless answer; the shape of the curve is what carries information.",
                           r"$K$ 变大时 WCSS 只会下降不会上升，$K = N$ 时每个点自成一簇，WCSS $= 0$。所以最小值总是没用的答案，有信息的是曲线的形状。")),
                 p(T(r"The elbow is a judgement call and sometimes there is none. A score that weighs compactness against $K$, such as the Calinski-Harabasz index at the end of this lesson, gives a number to compare instead.",
                     r"肘部要靠判断，有时根本没有明显的肘。把紧凑程度和 $K$ 一起权衡的指标，例如本课最后的 Calinski-Harabasz 指数，则给出一个可以比较的数。"))),

            # ---------------------------------------------------------------- deeper: coordinate descent
            derive('mean-min', T('Why the mean: the best centre of a group', '为什么用均值：一组点的最佳中心'),
                   [(r'f(c) = \sum_{i=1}^{n} (x_i - c)^2', T(r"Take one cluster with points $x_1, \dots, x_n$ and ask: which centre $c$ makes the sum of squared distances smallest? Call that sum $f(c)$.",
                                                              r"取一个簇，里面有点 $x_1, \dots, x_n$。问：中心 $c$ 取多少，平方距离之和最小？把这个和记作 $f(c)$。")),
                    (r"f'(c) = -2\sum_{i} (x_i - c)", T(r"Differentiate with respect to $c$. Each term $(x_i - c)^2$ has derivative $-2(x_i - c)$ (chain rule).", r"对 $c$ 求导。每一项 $(x_i - c)^2$ 的导数是 $-2(x_i - c)$（链式法则）。")),
                    (r'\sum_i x_i - n c = 0', T(r"At a minimum the derivative is 0. Divide by $-2$ and split the sum: $\sum_i c = n c$ because $c$ does not depend on $i$.", r"最小值处导数为 0。两边除以 $-2$ 再拆开求和：$c$ 与 $i$ 无关，所以 $\sum_i c = n c$。")),
                    (r'c = \frac{1}{n}\sum_i x_i = \bar{x}', T(r"Solve for $c$: the best centre is the **mean**.", r"解出 $c$：最佳中心就是**均值**。")),
                    (r"f''(c) = 2n > 0", T(r"The second derivative is positive, so this stationary point is a minimum (and the only one: $f$ is a parabola).", r"二阶导数为正，所以这个驻点是最小值（也是唯一的：$f$ 是一条抛物线）。")),
                    (rf'c = \frac{{{pts[0]}+{pts[1]}+{pts[2]}}}{{3}} = {fmt(mean)}', T(rf"Check with three points {', '.join(map(str, pts))}. The mean is {fmt(mean)}.", rf"用三个点 {', '.join(map(str, pts))} 检验。均值是 {fmt(mean)}。")),
                    (rf'f({fmt(mean)}) = {fmt(f5)} < f(4) = {fmt(f4)}', T(rf"The sum of squares at the mean is {fmt(f5)}; at another centre, say 4, it is {fmt(f4)}, larger, as promised.", rf"在均值处平方和是 {fmt(f5)}；在别的中心，比如 4，是 {fmt(f4)}，更大，正如推出的。"))],
                   intro=T(r"k-means moves each centroid to the mean of its cluster. That is not a convention: it is the answer to a minimisation, derived here.", r"k-means 把每个质心移到簇的均值处。这不是约定，而是一个最小化问题的答案，现在把它推出来。"),
                   outro=T(r"So the update step is exactly *the best centres for the current groups*. The same algebra gives $\sum_i (x_i - c)^2 = \sum_i (x_i - \bar{x})^2 + n(\bar{x} - c)^2$, so any other $c$ pays an extra $n(\bar x - c)^2$.", r"所以更新这一步恰好是“对当前分组的最佳中心”。同样的代数还给出 $\sum_i (x_i - c)^2 = \sum_i (x_i - \bar{x})^2 + n(\bar{x} - c)^2$，任何别的 $c$ 都要多付 $n(\bar x - c)^2$。"),
                   blank=(5, fmt(mean), T(r"Evaluate the mean of the points 2, 4 and 9.", r"算出 2、4、9 这三个点的均值。")), skill=KM, chapter=T('Deeper: why k-means converges', '深入：k-means 为什么会收敛')),
            derive('km-descent', T('k-means as coordinate descent on WCSS', 'k-means 是对 WCSS 的坐标下降'),
                   [(r'J(a, \mu) = \sum_{i=1}^{N} \lVert \mathbf{x}_i - \mu_{a_i} \rVert^2', T(r"What k-means secretly minimises. $a_i \in \{1..K\}$ is the cluster of instance $i$, $\mu_j$ is the centre of cluster $j$. $J$ is the WCSS: every point's squared distance to the centre of its own cluster.",
                                                                                                    r"k-means 暗中在最小化的东西。$a_i \in \{1..K\}$ 是实例 $i$ 所在的簇，$\mu_j$ 是簇 $j$ 的中心。$J$ 就是 WCSS：每个点到自己簇中心的距离平方之和。")),
                    (r'a_i \leftarrow \arg\min_j \lVert \mathbf{x}_i - \mu_j \rVert^2', T(r"**Assignment step** = minimise $J$ over $a$ with $\mu$ fixed. $J$ is a sum of $N$ terms, term $i$ depends only on $a_i$, so each point can choose on its own: its nearest centre.",
                                                                                           r"**分配步** = 固定 $\mu$，对 $a$ 最小化 $J$。$J$ 是 $N$ 项之和，第 $i$ 项只依赖 $a_i$，所以每个点可以各自挑选：最近的那个中心。")),
                    (r'J(a^{\text{new}}, \mu) \le J(a^{\text{old}}, \mu)', T(r"Each point either keeps its cluster or moves to one that is at least as near, so no term gets bigger.", r"每个点要么留在原簇，要么换到不比原来远的簇，所以没有哪一项变大。")),
                    (r'\mu_j \leftarrow \frac{1}{|C_j|}\sum_{i \in C_j} \mathbf{x}_i', T(r"**Update step** = minimise $J$ over $\mu$ with $a$ fixed. $J$ splits into one sum per cluster, and in each the best centre is the mean (previous page, applied per coordinate).", r"**更新步** = 固定 $a$，对 $\mu$ 最小化 $J$。$J$ 拆成每个簇一个和，每个簇里最佳中心都是均值（上一页的结论，逐个坐标成立）。")),
                    (r'J(a, \mu^{\text{new}}) \le J(a, \mu^{\text{old}})', T(r"The mean is the minimiser, so replacing any centre by it cannot make its cluster's sum bigger.", r"均值是最小值点，把中心换成它，该簇的平方和不可能变大。")),
                    (r'J_0 \ge J_1 \ge J_2 \ge \dots \ge 0', T(r"Each round is an assignment step then an update step, each never increasing $J$. So $J$ is a non-increasing sequence bounded below by 0.", r"每一轮是一次分配加一次更新，两步都不增加 $J$。所以 $J$ 是一个不增、且下界为 0 的序列。")),
                    (r'|\mathcal{P}| \le K^N', T(r"There are only finitely many ways to split $N$ points into $K$ groups: the set $\mathcal{P}$ of partitions has at most $K^N$ members. After an update, the centres are determined by the partition, and $J$ is a function of the partition.", r"把 $N$ 个点分成 $K$ 组的方式只有有限种。更新之后，中心由分组决定，$J$ 是分组的函数。")),
                    (r'J_{t+1} < J_t \;\lor\; \mathcal{P}_{t+1} = \mathcal{P}_t', T(r"With ties broken consistently, a round (partition $\mathcal{P}_t \to \mathcal{P}_{t+1}$) either lowers $J$ strictly or leaves the partition unchanged ($\lor$ means "or"). A partition cannot repeat without $J$ staying equal, so the algorithm stops after finitely many rounds.", r"平局按固定规则处理时，每一轮要么让 $J$ 严格下降（得到新的分组），要么什么都不变。若分组重复，$J$ 必须保持不变，也就是已经停了，所以算法在有限轮内一定停下。"))],
                   intro=T(r"Why does k-means stop, and does it stop at the best clustering? Both answers come from reading the two steps as *minimise over one block of unknowns while the other is held fixed*: coordinate descent.", r"k-means 为什么会停，停下来的是不是最好的聚类？两个答案都来自一个读法：把两步看成“固定一组未知量，对另一组求最小”，也就是坐标下降。"),
                   outro=T(r"**It converges, but only to a fixed point:** a pair $(a, \mu)$ that neither step can improve. That is a *local* minimum of $J$ (a minimum along each block), not necessarily the global one, because $J$ is not convex in $(a, \mu)$ together.", r"**它一定收敛，但只收敛到一个不动点**：一对 $(a, \mu)$，两步都改进不了。这是 $J$ 的*局部*最小值（沿每一块坐标是最小），不一定是全局最小，因为 $J$ 对 $(a, \mu)$ 整体并不是凸的。"),
                   skill=KM),
            read('local', T('A local optimum you can compute', '一个能算出来的局部最优'),
                 p(T(rf"Take $x = {', '.join(map(str, XL))}$ with $K = 3$. The obvious clusters are the three adjacent pairs. Run k-means from two different seed sets:", rf"取 $x = {', '.join(map(str, XL))}$，$K = 3$。显然的簇是三对相邻的点。从两组不同的种子出发跑 k-means：")),
                 table([T('Seeds', '种子'), T('Final clusters', '最终的簇'), T('WCSS', 'WCSS')],
                       [str((0, 5, 11)), '{0,1} {5,6} {11,12}', fmt(w_good, 2)],
                       [str((0, 1, 5)), '{0} {1} {5,6,11,12}', fmt(w_bad, 2)]),
                 p(T(rf"The second run is a true fixed point: the centroids are 0, 1 and {fmt(np.mean([5, 6, 11, 12]))}; every point is nearest to its own centroid (6 is {fmt(abs(6 - 8.5))} from 8.5 and 5 from 1), so nothing moves. Yet its WCSS is {fmt(w_bad, 2)} against {fmt(w_good, 2)}: k-means gives no guarantee about which one you get.",
                     rf"第二次是真正的不动点：质心是 0、1 和 {fmt(np.mean([5, 6, 11, 12]))}；每个点离自己的质心最近（6 离 8.5 是 {fmt(abs(6 - 8.5))}，离 1 是 5），所以谁也不动。可它的 WCSS 是 {fmt(w_bad, 2)}，另一个只有 {fmt(w_good, 2)}：k-means 不保证你得到哪一个。")),
                 p(T(r"In practice: run it several times from different random seeds and keep the lowest WCSS, or choose seeds that are far apart (the idea of k-means++, a textbook refinement, not in the deck).",
                     r"实际做法：用不同随机种子多跑几次，留下 WCSS 最小的那个；或者让种子彼此相距较远（k-means++ 的思路，是教材里的改进，课件没讲）。")),
                 quiz(T('Which statement about k-means is true?', '关于 k-means，哪句话是对的？'),
                      [(T('It always finds the clustering with the lowest WCSS', '它总能找到 WCSS 最低的聚类'), T('It only finds a local optimum: the example above stops at WCSS 37 although 1.5 is possible.', '它只能找到局部最优：上面的例子停在 WCSS 37，而 1.5 是可能的。')),
                       (T('It might loop forever because the centroids can keep moving', '质心可能一直动，所以可能永远不停'), T('It always terminates: J falls or the partition stays, and there are finitely many partitions.', '它一定会停：J 下降或分组不变，而分组只有有限种。')),
                       (T('It always stops, but possibly at a local optimum that depends on the seeds', '它一定会停，但可能停在取决于种子的局部最优'), True)],
                      T('Termination is guaranteed by the coordinate-descent argument; optimality is not.', '终止由坐标下降的论证保证；最优性没有保证。'))),

            # ---------------------------------------------------------------- hierarchical
            read('hier', T('Hierarchical clustering: a tree of merges', '层次聚类：一棵合并树'),
                 p(T(r"Instead of one flat split, hierarchical clustering produces **nested** clusters, recorded as a tree called a **dendrogram**: the height of each bar is the distance at which two clusters were merged. Cutting the tree horizontally gives any number of clusters you like.",
                     r"层次聚类不是一刀平面切分，而是产生**嵌套**的簇，记成一棵树，叫**树状图**（dendrogram）：每根横线的高度就是两个簇被合并时的距离。在某个高度横着切一刀，就得到相应个数的簇。")),
                 table(['', T('Agglomerative (bottom-up)', '凝聚（自底向上）'), T('Divisive (top-down)', '分裂（自顶向下）')],
                       [T('Start', '起点'), T('every instance is its own cluster', '每个实例自成一簇'), T('one cluster with everything', '一个包含全部的簇')],
                       [T('Each step', '每一步'), T('merge the two closest clusters', '合并最近的两个簇'), T('split one cluster', '拆开一个簇')],
                       [T('End', '终点'), T('one cluster (or K left)', '只剩一个簇（或剩 K 个）'), T('singletons (or K clusters)', '每个点一簇（或得到 K 个簇）')]),
                 p(T(r"Both use a distance (proximity) matrix between instances. This lesson works agglomerative clustering fully; divisive is its mirror image and is covered only at this level in the deck. The algorithm: make each point a cluster, compute the distance matrix, then repeat *merge the two closest clusters, update the matrix* until one cluster remains.",
                     r"两者都用实例之间的距离（相似度）矩阵。这一课把凝聚聚类算完整；分裂聚类是它的镜像，课件也只讲到这个程度。算法：每个点当一个簇，算距离矩阵，然后重复“合并最近的两个簇、更新矩阵”，直到只剩一个簇。")),
                 p(T(r"The only open question is the distance between two *clusters*. The deck lists four answers:", r"唯一没定的是两个*簇*之间的距离。课件给了四种答案：")),
                 table([T('Linkage', '链接方式'), T('Distance between clusters $A$ and $B$', '簇 $A$、$B$ 之间的距离')],
                       [T('Single', '单链'), T(r"closest pair: $\min_{a \in A, b \in B} d(a, b)$", r"最近的一对：$\min_{a \in A, b \in B} d(a, b)$")],
                       [T('Complete', '全链'), T(r"farthest pair: $\max_{a \in A, b \in B} d(a, b)$", r"最远的一对：$\max_{a \in A, b \in B} d(a, b)$")],
                       [T('Average', '平均链'), T(r"mean of all pairs: $\frac{1}{|A||B|}\sum_{a, b} d(a, b)$", r"所有配对的平均：$\frac{1}{|A||B|}\sum_{a, b} d(a, b)$")],
                       [T('Centroid', '质心链'), T(r"distance between the two centroids", r"两个质心之间的距离")]),
                 chapter=T('Hierarchical clustering', '层次聚类')),
            derive('single-link', T('Single linkage on the deck\'s 5-instance matrix', '在课件的 5 实例矩阵上做单链'), trace_lines('single'),
                   intro=T(r"The cells of the matrix are the distances between instances, *not* coordinates. Five instances, so four merges.", r"矩阵里的数是实例之间的距离，*不是*坐标。五个实例，所以合并四次。"),
                   outro=T(r"Single linkage keeps the **minimum** each time, so clusters grow by their closest pair: 5, 10, 15, 30.", r"单链每次都取**最小**，簇靠最近的一对往外长：5、10、15、30。"),
                   skill=HC),
            derive('complete-link', T('Complete linkage on the same matrix', '同一个矩阵上做全链'), trace_lines('complete'),
                   intro=T(r"Same matrix, same first merge. Only the update rule changes: keep the **maximum**.", r"同一个矩阵，第一次合并也一样。只有更新规则变了：取**最大**。"),
                   outro=T(r"The two linkages disagree after step 1: single ends with 3 joined last at 30, complete pairs (3, 5) at 40 and joins everything at 50.", r"第 1 步之后两种链接就分道扬镳：单链最后在 30 把 3 接上，全链先在 40 把 (3, 5) 配成一对，最后在 50 合并所有。"),
                   skill=HC),
            derive('average-link', T('Average linkage on the same matrix', '同一个矩阵上做平均链'), trace_lines('average'),
                   intro=T(r"Average linkage sits between the two extremes: it uses the mean of all pair distances.", r"平均链介于两个极端之间：用所有配对距离的平均。"),
                   outro=T(r"Same first merge again; heights 5, 17.5, 26.67, 38.75. Centroid linkage (distance between centroids) needs coordinates rather than just this matrix; the deck shows only that its tree can violate the hierarchy (a later merge can be lower than an earlier one, an *inversion*) and that it is sensitive to outliers, like k-means.",
                           r"第一次合并还是一样；高度 5、17.5、26.67、38.75。质心链（质心之间的距离）需要坐标，光有这个矩阵不够；课件只指出：它的树可能违反层次结构（后一次合并的高度可以比前一次低，叫*倒挂*），并且像 k-means 一样对离群点敏感。"),
                   skill=HC),
            read('dendro', T('The three dendrograms side by side', '三棵树状图并排看'),
                 svg(drawn(fig_dendrograms), T('Three dendrograms over the leaves 1 to 5. Single: 1 and 4 at 5, 5 at 10, 2 at 15, 3 at 30. Complete: 1 and 4 at 5, 2 at 20, 3 and 5 at 40, all at 50. Average: 1 and 4 at 5, 2 at 17.5, 5 at 26.7, 3 at 38.8.',
                                                    '以 1 到 5 为叶子的三棵树状图。单链：1、4 在 5 合并，5 在 10，2 在 15，3 在 30。全链：1、4 在 5，2 在 20，3、5 在 40，全部在 50。平均链：1、4 在 5，2 在 17.5，5 在 26.7，3 在 38.8。'),
                     T(r"Heights are the merge distances. Cut at a height to read off the clusters.", r"高度是合并距离。在某个高度切开，就读出相应的簇。")),
                 p(T(rf"To read off K = 2 clusters, cut below the last merge. Single: {{1,4,5,2}} and {{3}}. Complete: {{1,4,2}} and {{3,5}}. Average: {{1,4,2,5}} and {{3}}. Different linkages, different answers on the same data: the linkage is a modelling choice, like the distance.",
                     rf"要读出 K = 2 个簇，就在最后一次合并之下切。单链：{{1,4,5,2}} 和 {{3}}。全链：{{1,4,2}} 和 {{3,5}}。平均链：{{1,4,2,5}} 和 {{3}}。同样的数据、不同的链接，答案不同：链接是一个建模选择，和距离的选择一样。")),
                 quiz(T('In the complete-linkage run, why is 5 not merged with {1,4,2} at height 25 (its distance to 2)?', '全链里，为什么 5 没有在高度 25（它到 2 的距离）处并进 {1,4,2}？'),
                      [(T('Complete linkage measures the *farthest* pair: from 5 to {1,4,2} that is 45', '全链看的是*最远*的一对：5 到 {1,4,2} 是 45'), True),
                       (T('Because 25 is bigger than 20', '因为 25 比 20 大'), T('Merges are chosen by the smallest cluster distance in the current matrix; the cluster distance here is not 25.', '合并选的是当前矩阵里最小的簇间距离；这里簇间距离不是 25。')),
                       (T('Because complete linkage only merges instances, never clusters', '因为全链只合并实例，不合并簇'), T('It merges clusters like any agglomerative method.', '它和其他凝聚方法一样合并簇。'))],
                      T('One far member keeps a cluster away under complete linkage.', '全链下，只要有一个成员离得远，整个簇就远。'))),
            read('chain', T('Deeper: why single chains and complete stays compact', '深入：单链为何会“串成一条”、全链为何偏紧凑'),
                 p(T(r"Single linkage asks only: is there *some* pair, one in each cluster, that is close? Then a thin strand of points between two groups is a chain of small steps, and each step merges at a small height. Complete linkage asks: are *all* pairs close? A cluster's distance to anything is at least the distance across its own spread, so clusters only merge while they stay compact.",
                     r"单链只问：两个簇里是否*有一对*点离得近？那么两组之间一条稀疏的点链就是一连串小步，每一步都在很低的高度合并。全链问的是：*所有*配对是否都近？簇和任何东西的距离至少是它自身展开的跨度，所以簇只有在保持紧凑时才会合并。")),
                 svg(drawn(fig_chain), T('Twelve points: a group A on the left, a group B on the right, and a thin strand between them. Left panel, single linkage with K = 2; right panel, complete linkage with K = 2, which splits the strand in the middle.',
                                         '十二个点：左边一组 A，右边一组 B，中间一条细链。左图为单链 K = 2；右图为全链 K = 2，把细链从中间分开。'),
                     T(r"Same 12 points, same K: the colours are the two clusters each linkage returns.", r"同样的 12 个点、同样的 K：颜色是两种链接各自得到的两个簇。")),
                 p(T(rf"The last four merge heights tell the story. Single: {', '.join(fmt(d, 2) for d, _, _ in CHAIN_SINGLE[-4:])}, almost flat, so the dendrogram offers no natural place to cut and the final split lands on whichever gap is marginally larger (here between A and the strand). Complete: {', '.join(fmt(d, 2) for d, _, _ in CHAIN_COMPLETE[-4:])}, a jump before the end, which the cut can use.",
                     rf"最后四次合并的高度说明了问题。单链：{', '.join(fmt(d, 2) for d, _, _ in CHAIN_SINGLE[-4:])}，几乎持平，树状图里没有天然的切点，最后一刀落在哪个缝隙只取决于谁稍微大一点（这里是 A 和细链之间）。全链：{', '.join(fmt(d, 2) for d, _, _ in CHAIN_COMPLETE[-4:])}，到最后有一个跳升，切在那里有意义。")),
                 table(['', T('Single linkage', '单链'), T('Complete linkage', '全链')],
                       [T('Strength', '优点'), T('handles non-elliptical shapes (a long thin cluster is fine)', '能处理非椭圆的形状（细长的簇没问题）'), T('less sensitive to noise and outliers', '对噪声和离群点不那么敏感')],
                       [T('Weakness', '缺点'), T('sensitive to noise and outliers: one stray point can bridge two clusters (chaining)', '对噪声和离群点敏感：一个游离点就能把两个簇接起来（链式效应）'), T('prefers compact, same-diameter clusters and tends to break large clusters', '偏好紧凑、直径相近的簇，容易把大簇拆开')]),
                 quiz(T('A few noisy points lie in a line between two clearly separate groups. Which linkage merges the two groups first?', '两个明显分开的组之间有几个噪声点连成一线。哪种链接会最先把两组并到一起？'),
                      [(T('Complete linkage', '全链'), T('Complete linkage looks at the farthest pair, which stays large however many points lie in between.', '全链看最远的一对，中间有多少点都不会让它变小。')),
                       (T('Single linkage', '单链'), True),
                       (T('Both merge them at the same height', '两者在同一高度合并'), T('Single links through the strand at tiny steps; complete does not.', '单链通过细链用很小的步子连上；全链不会。'))],
                      T('That is chaining: single linkage follows the shortest hops.', '这就是链式效应：单链顺着最短的跳跃走。'))),
            read('hier-pros', T('Hierarchical clustering against k-means', '层次聚类和 k-means 的对比'),
                 table(['', T('k-means', 'k-means'), T('Agglomerative', '凝聚层次聚类')],
                       [T('Type', '类型'), T('partitioning', '划分'), T('hierarchical', '层次')],
                       [T('Needs K in advance?', '要预先给 K？'), T('yes', '要'), T('no: cut the dendrogram at any level', '不要：在任意高度切树状图')],
                       [T('Cluster shapes', '簇的形状'), T('round, similar size (assumption)', '圆形、大小相近（假设）'), T('no assumption on shape; depends on the linkage', '对形状没有假设；取决于链接方式')],
                       [T('Objective', '目标函数'), T('minimises WCSS (locally)', '（局部）最小化 WCSS'), T('none: no objective function is directly minimised, so no "relative" quality measure', '没有：不直接最小化任何目标函数，也就没有“相对”的质量度量')],
                       [T('Mistakes', '犯错之后'), T('points can move between clusters every round', '每一轮点都可以换簇'), T('a merge can never be undone: a point in the wrong cluster stays there', '合并后不能撤销：进错簇的点永远在里面')],
                       [T('Cost', '开销'), T('cheap, scales to large data', '便宜，能用于大数据'), T('needs the full distance matrix, so costly for large N', '需要完整距离矩阵，N 大时开销大（教材常识）')]),
                 p(T(r"Hierarchical clustering can also give meaningful taxonomies (animal kingdom, phylogeny). Both families are sensitive to outliers in some way: k-means through its means, single linkage through chaining, centroid linkage like k-means.",
                     r"层次聚类还能给出有意义的分类体系（动物界、系统发生树）。两类方法都在某种意义上怕离群点：k-means 通过均值，单链通过链式效应，质心链和 k-means 一样。"))),

            # ---------------------------------------------------------------- evaluation
            read('eval', T('Evaluating a clustering: cohesion and separation', '评价聚类：凝聚度与分离度'),
                 p(T(r"There are no true labels to compare with, so the measures ask what a good clustering looks like by itself. A good clustering has one or both of:", r"没有真实标签可对照，所以这些指标只问：一个好的聚类本身应该是什么样。好的聚类具备下面一条或两条：")),
                 ul(T(r"**High cohesion** (compactness): instances in a cluster are close to each other. Measured by the **WCSS**, the within-cluster sum of squares. Lower is better.", r"**高凝聚度**（紧凑）：簇内实例彼此接近。用 **WCSS**（簇内平方和）衡量，越小越好。"),
                    T(r"**High separation** (distinct clusters): different clusters are far apart. Measured by the **BCSS**, the between-cluster sum of squares. Higher is better.", r"**高分离度**（簇间分得开）：不同的簇彼此远离。用 **BCSS**（簇间平方和）衡量，越大越好。")),
                 math_(r'\mathrm{WCSS} = \sum_{j=1}^{K} \sum_{\mathbf{x}_i \in C_j} \lVert \mathbf{x}_i - \mu_j \rVert^2'),
                 p(T(r"For each cluster $C_j$ with mean $\mu_j$, add up each member's squared distance to it, then add over clusters. This is the same $J$ k-means minimises.", r"对每个簇 $C_j$（均值 $\mu_j$），把每个成员到它的距离平方加起来，再对簇求和。这和 k-means 最小化的 $J$ 是同一个量。")),
                 math_(r'\mathrm{BCSS} = \sum_{j=1}^{K} n_j \, \lVert \mu - \mu_j \rVert^2'),
                 p(T(r"Here $\mu$ is the mean of all the data and $n_j$ the size of cluster $j$: how far each cluster centre lies from the overall centre, counted once per member, so big clusters count more.", r"这里 $\mu$ 是全部数据的均值，$n_j$ 是簇 $j$ 的大小：每个簇的中心离总体中心多远，每个成员算一次，所以大簇权重更大。")),
                 p(T(r"The deck's summary lists unsupervised metrics (the cohesion and separation above) and supervised ones. The slides show only the former, so what follows is the textbook version of the rest, to be able to answer \"how else would you evaluate a clustering?\".",
                     r"课件的小结列了无监督指标（上面的凝聚度和分离度）和有监督指标。幻灯片只展示了前者，下面是教材里其余部分的标准说法，用来回答“还有什么办法评价聚类”。")),
                 details(T('Silhouette (textbook)', '轮廓系数（教材）'),
                         p(T(r"For one instance, let $a$ be its mean distance to the other members of its own cluster and $b$ its mean distance to the members of the nearest other cluster. The silhouette is $s = (b - a)/\max(a, b) \in [-1, 1]$: near 1 well placed, near 0 on a boundary, negative probably in the wrong cluster. The mean over all instances scores a clustering and can be compared across $K$.",
                             r"对一个实例，设 $a$ 为它到本簇其他成员的平均距离，$b$ 为它到最近的其他簇成员的平均距离。轮廓系数 $s = (b - a)/\max(a, b) \in [-1, 1]$：接近 1 表示位置很好，接近 0 表示在边界上，负数说明可能分错了簇。对所有实例取平均，就能给一个聚类打分，并跨 $K$ 比较。"))),
                 details(T('When labels exist: purity and entropy (textbook)', '有标签时：纯度和熵（教材）'),
                         p(T(r"If true classes are known (not used for clustering), compare them with the clusters. **Purity**: for each cluster take the count of its most common class, sum these, divide by $N$. **Entropy**: for each cluster compute $-\sum_c p_{jc}\log_2 p_{jc}$ over the class proportions in it, and average weighted by cluster size; lower is purer. Purity is easy to read but is trivially 1 when every point is its own cluster, so it must be used with a fixed $K$.",
                             r"如果知道真实类别（聚类时没用到），就拿它们和簇对比。**纯度**（purity）：对每个簇取其中最多的那个类的个数，求和后除以 $N$。**熵**：对每个簇，按其中各类的比例算 $-\sum_c p_{jc}\log_2 p_{jc}$，再按簇大小加权平均；越小越纯。纯度好读，但每个点自成一簇时它平凡地等于 1，所以只能在 $K$ 固定时用。"))),
                 chapter=T('Evaluating clusters', '评价聚类')),
            derive('tss', T('WCSS and BCSS add up to a constant', 'WCSS 与 BCSS 之和是常数'),
                   [(r'\mathrm{TSS} = \sum_{i=1}^{N} \lVert \mathbf{x}_i - \mu \rVert^2', T(r"The **total** sum of squares: every point's squared distance to the overall mean $\mu$. It depends only on the data, not on any clustering.", r"**总**平方和：每个点到总体均值 $\mu$ 的距离平方之和。它只取决于数据，与任何聚类无关。")),
                    (r'\mathbf{x}_i - \mu = (\mathbf{x}_i - \mu_j) + (\mu_j - \mu)', T(r"For a point $i$ in cluster $j$, go through the cluster mean: first from the point to its cluster centre, then from there to the overall centre.", r"对簇 $j$ 里的点 $i$，经过簇均值走一步：先从点到簇中心，再从簇中心到总体中心。")),
                    (r'\lVert \cdot \rVert^2 = \lVert \mathbf{x}_i - \mu_j \rVert^2 + \lVert \mu_j - \mu \rVert^2 + 2(\mathbf{x}_i - \mu_j)^{\top}(\mu_j - \mu)', T(r"Expand the square of a sum.", r"展开和的平方。")),
                    (r'\sum_{i \in C_j} (\mathbf{x}_i - \mu_j) = \mathbf{0}', T(r"Summed over the points of one cluster, the cross term vanishes: the deviations from a cluster's own mean add to zero (that is what a mean is).", r"在同一簇的点上求和，交叉项消失：到自己簇均值的偏差加起来为零（均值的定义就是这样）。")),
                    (r'\mathrm{TSS} = \mathrm{WCSS} + \mathrm{BCSS}', T(r"What is left: the first term summed gives WCSS, and the second, which is the same for all $n_j$ members, gives $n_j\lVert \mu_j - \mu \rVert^2$, i.e. BCSS.", r"剩下的：第一项求和是 WCSS；第二项对 $n_j$ 个成员都一样，求和得 $n_j\lVert \mu_j - \mu \rVert^2$，也就是 BCSS。")),
                    (rf'{fmt(cA["w"], 3)} + {fmt(cA["b"], 3)} = {fmt(tss, 3)}', T(r"Check on the deck's six points $0, 0.5, 1, 3, 4, 5$ (next page) with clusters $\{0,0.5,1\}$, $\{3,4,5\}$.", r"用课件的六个点 $0, 0.5, 1, 3, 4, 5$（下一页）和簇 $\{0,0.5,1\}$、$\{3,4,5\}$ 检验。"))],
                   intro=T(r"Why are WCSS and BCSS two sides of one coin?", r"为什么 WCSS 和 BCSS 像是一枚硬币的两面？"),
                   outro=T(r"The total is fixed, so for a given dataset **lowering WCSS and raising BCSS are the same move**. That is why k-means (which minimises WCSS) also pushes clusters apart, and why the CH index below can be written with either.", r"总量固定，所以对同一份数据，**降低 WCSS 和提高 BCSS 是同一件事**。这就是 k-means（最小化 WCSS）同时也把簇推开的原因，也是下面 CH 指数用哪个都能写的原因。"),
                   skill=EV),
            read('ch', T('Calinski-Harabasz: one number for the trade-off', 'Calinski-Harabasz：把权衡写成一个数'),
                 p(T(r"WCSS alone always improves with more clusters. The **Calinski-Harabasz (CH) index**, also called the variance ratio criterion, uses both compactness and separation and charges for $K$:", r"光看 WCSS，簇越多总是越好。**Calinski-Harabasz（CH）指数**，也叫方差比准则，同时用紧凑度和分离度，并对 $K$ 收费：")),
                 math_(r'CH = \frac{BCSS/(K-1)}{WCSS/(N-K)} = \frac{BCSS}{WCSS} \times \frac{N-K}{K-1}'),
                 ul(T(r"$BCSS/WCSS$: how much of the spread is between clusters relative to within them. Bigger = better separated and more compact.", r"$BCSS/WCSS$：簇间的离散程度相对簇内的比值。越大 = 分得越开、越紧凑。"),
                    T(r"$(N-K)/(K-1)$: divides each sum by its degrees of freedom (BCSS has $K - 1$ free centres, WCSS has $N - K$ free points), so a larger $K$ does not win just by cutting WCSS.", r"$(N-K)/(K-1)$：把每个平方和除以自己的自由度（BCSS 有 $K-1$ 个自由的中心，WCSS 有 $N-K$ 个自由的点），所以 $K$ 大并不能只靠压低 WCSS 取胜。"),
                    T(r"**Higher CH = better-defined clusters.** Compare the same dataset under different clusterings or different $K$; the absolute value alone means little.", r"**CH 越高 = 簇划分得越清晰。** 在同一份数据上比较不同聚类或不同 $K$；单个数值本身没多少意义。"))),
            derive('ch-example', T('The deck\'s example: A (K = 2) or B (K = 3)?', '课件的例子：A（K = 2）还是 B（K = 3）？'),
                   [(r'x = 0,\ 0.5,\ 1,\ 3,\ 4,\ 5, \qquad N = 6', T(r"Six points on a line. Clustering A: $\{0, 0.5, 1\}$ and $\{3, 4, 5\}$. Clustering B: $\{0, 0.5\}$, $\{1, 3\}$ and $\{4, 5\}$.", r"数轴上六个点。聚类 A：$\{0, 0.5, 1\}$ 和 $\{3, 4, 5\}$。聚类 B：$\{0, 0.5\}$、$\{1, 3\}$ 和 $\{4, 5\}$。")),
                    (rf'\mu = {fmt(CH_X.mean(), 2)}', T(r"The overall mean: the sum is 13.5, divided by 6.", r"总体均值：和是 13.5，除以 6。")),
                    (r'\mu_1 = 0.5,\ \mu_2 = 4', T(r"Clustering A: the two cluster means.", r"聚类 A：两个簇的均值。")),
                    (rf'WCSS_A = (0.25 + 0 + 0.25) + (1 + 0 + 1) = {fmt(cA["w"], 3)}', T(r"Squared distances to the own mean, cluster by cluster.", r"逐簇，每个点到自己簇均值的距离平方。")),
                    (rf'BCSS_A = 3(2.25 - 0.5)^2 + 3(2.25 - 4)^2 = {fmt(cA["b"], 3)}', T(r"Each cluster has 3 members; each centre is 1.75 from the overall mean.", r"每个簇 3 个成员；每个簇中心离总体均值 1.75。")),
                    (rf'CH_A = \frac{{{fmt(cA["b"], 3)}}}{{{fmt(cA["w"], 3)}}} \times \frac{{6-2}}{{2-1}} = {fmt(cA["ch"], 1)}', T(r"Plug in: $N = 6$, $K = 2$.", r"代入：$N = 6$，$K = 2$。")),
                    (r'\mu_1 = 0.25,\ \mu_2 = 2,\ \mu_3 = 4.5', T(r"Clustering B: the three cluster means.", r"聚类 B：三个簇的均值。")),
                    (rf'WCSS_B = 0.125 + 2 + 0.5 = {fmt(cB["w"], 3)}', T(r"The pair $\{1, 3\}$ alone costs 2: it is the loose cluster.", r"仅 $\{1, 3\}$ 这一簇就是 2：它是松散的那一个。")),
                    (rf'BCSS_B = 2(2)^2 + 2(0.25)^2 + 2(2.25)^2 = {fmt(cB["b"], 3)}', T(r"Each cluster has 2 members. The centres 0.25, 2 and 4.5 are 2, 0.25 and 2.25 away from the overall mean 2.25.", r"每个簇 2 个成员。三个中心 0.25、2、4.5 到总体均值 2.25 的距离分别是 2、0.25、2.25。")),
                    (rf'CH_B = \frac{{{fmt(cB["b"], 2)}}}{{{fmt(cB["w"], 3)}}} \times \frac{{6-3}}{{3-1}} \approx {fmt(cB["ch"], 2)}', T(r"Plug in: $N = 6$, $K = 3$.", r"代入：$N = 6$，$K = 3$。"))],
                   intro=T(r"Which clustering of the same six points is better, according to the CH index?", r"同样六个点，按 CH 指数，哪种聚类更好？"),
                   outro=T(rf"**A wins: {fmt(cA['ch'], 1)} against {fmt(cB['ch'], 2)}.** A's clusters are both tighter (WCSS {fmt(cA['w'], 1)} against {fmt(cB['w'], 3)}) and a little more separated, with fewer clusters to pay for.", rf"**A 胜：{fmt(cA['ch'], 1)} 对 {fmt(cB['ch'], 2)}。** A 的簇更紧（WCSS {fmt(cA['w'], 1)} 对 {fmt(cB['w'], 3)}），分得也略开一点，还少付一些 $K$ 的代价。"),
                   skill=EV),
            # ---------------------------------------------------------------- practice
            number('p-ch', T('Compute a CH index', '计算 CH 指数'), EV,
                   T(r"Same data as the previous question: $\{1, 3\}$ and $\{8, 10, 12\}$ ($N = 5$, $K = 2$). Compute the CH index. Round to 1 decimal place.", r"和上一题相同的数据：$\{1, 3\}$ 和 $\{8, 10, 12\}$（$N = 5$，$K = 2$）。计算 CH 指数，保留 1 位小数。"),
                   ch_index(np.array([1, 3, 8, 10, 12], float).reshape(-1, 1), np.array([0, 0, 1, 1, 1]), 2),
                   T(r"Overall mean $34/5 = 6.8$. $BCSS = 2(6.8-2)^2 + 3(10-6.8)^2 = 46.08 + 30.72 = 76.8$. $WCSS = 10$. $CH = 76.8/10 \times (5-2)/(2-1) = 23.04$.", r"总体均值 $34/5 = 6.8$。$BCSS = 2(6.8-2)^2 + 3(10-6.8)^2 = 46.08 + 30.72 = 76.8$。$WCSS = 10$。$CH = 76.8/10 \times (5-2)/(2-1) = 23.04$。"), tolerance=0.06, chapter=T('Exam practice', '考试练习')),
            choice('p-k', T('Choosing K', '选 K'), KM,
                   T(r"A student runs k-means for $K = 1, \dots, 10$ and reports $K = 10$ because it has the lowest WCSS. What is wrong?", r"一位同学对 $K = 1, \dots, 10$ 各跑一次 k-means，因为 $K = 10$ 的 WCSS 最低就选了它。问题在哪？"),
                   [(T('WCSS is only meaningful for K up to 5', 'WCSS 只在 K 不超过 5 时有意义'), T('There is no such limit.', '没有这个限制。')),
                    (T('WCSS can only fall as K grows (zero at K = N), so its minimum is uninformative; look for an elbow or use a score such as CH', 'K 越大 WCSS 只会下降（K = N 时为零），所以最小值没有信息；应看肘部，或用 CH 之类的指标'), True),
                    (T('k-means is not allowed to use K larger than the number of features', 'k-means 的 K 不能超过特征数'), T('K is limited by N, not by the number of features.', 'K 受 N 限制，而不是受特征数限制。'), 'wcss-pick-k')],
                   T('Selecting K needs a criterion that does not improve automatically with K.', '选 K 需要一个不会随 K 自动变好的标准。'), purpose='check'),
            choice('p-linkage', T('Which linkage?', '哪种链接？'), HC,
                   T(r"Data: two long, thin, curved groups, plus a few noise points scattered far away. Which linkage would you worry about, and why?", r"数据：两个细长弯曲的组，外加几个远处散落的噪声点。你会担心哪种链接，为什么？"),
                   [(T('Complete linkage tends to prefer compact, equal-diameter clusters and break long ones, so it will cut the thin groups', '全链偏好紧凑、直径相近的簇，会把细长的组拆开'), True),
                    (T('Single linkage, because it takes the farthest pair and noise is far away', '单链，因为它取最远的一对而噪声很远'), T('Single takes the *closest* pair; the farthest pair is complete linkage. (Single is sensitive to noise for another reason: strands of noise chain clusters.)', '单链取的是*最近*的一对，最远的一对是全链。（单链怕噪声是另一个原因：噪声串成链会把簇接起来。）'), 'linkage-swap'),
                    (T('Neither: hierarchical clustering ignores noise', '都不用担心：层次聚类会忽略噪声'), T('Hierarchical methods cluster every point; noise ends up in merges.', '层次方法把每个点都聚进去；噪声会参与合并。'))],
                   T('Here complete linkage breaks the thin groups, while single can follow them (but beware noise bridges).', '这里全链会拆开细长的组，单链能顺着它们走（但要提防噪声搭桥）。')),
            text_q('p-compare', T('Section A: k-means or hierarchical?', 'A 部分：k-means 还是层次聚类？'), KM,
                   T(r"Compare k-means and agglomerative clustering: name two differences and one limitation of each. (1-3 lines.)", r"比较 k-means 和凝聚层次聚类：各说两处不同，以及各自的一个局限。（1-3 行。）"),
                   [T('k-means needs K in advance; agglomerative gives a dendrogram to cut at any level', 'k-means 需要预先给 K；凝聚聚类给出可在任意高度切的树状图'),
                    T('k-means partitions and minimises WCSS (locally); hierarchical has no objective and a merge cannot be undone', 'k-means 做划分、（局部）最小化 WCSS；层次聚类没有目标函数且合并不可撤销'),
                    T('Limits: k-means is sensitive to initialisation, outliers and non-spherical shapes; linkage choices bring chaining (single) or breaking large clusters (complete)', '局限：k-means 对初始化、离群点和非球形敏感；链接带来链式效应（单链）或拆大簇（全链）')],
                   T('k-means needs K and gives a flat partition that minimises WCSS only locally, so it depends on the seeds, outliers and spherical shapes. Agglomerative clustering needs no K (cut the dendrogram), makes no shape assumption beyond the linkage, but has no objective and cannot undo a merge; single linkage chains and complete linkage breaks large clusters.',
                     'k-means needs K and gives a flat partition that minimises WCSS only locally, so it depends on the seeds, outliers and spherical shapes. Agglomerative clustering needs no K (cut the dendrogram), makes no shape assumption beyond the linkage, but has no objective and cannot undo a merge; single linkage chains and complete linkage breaks large clusters.'),
                   T('Two contrasts and a limitation for each is what the marker looks for.', '阅卷看的是两处对比和各自的局限。')),
            text_q('p-design', T('Section C: segmenting customers', 'C 部分：给顾客分群'), HC,
                   T(r"A shop has, for 50,000 customers, the number of purchases, mean basket value, and a categorical favourite category. Design a clustering analysis to find customer segments: choose a method, say how you prepare the data, how you choose K, and how you judge the result.", r"一家店有 5 万名顾客的购买次数、平均客单价，以及一个类别型的“最爱品类”。设计一个聚类分析来找顾客群：选方法，说明数据怎么准备，K 怎么选，结果怎么评价。"),
                   [T('Scale the numeric features; handle the categorical one (one-hot, or a mixed distance) since the mean is undefined for categories', '把数值特征缩放；类别型特征要处理（独热编码或混合距离），因为类别没有均值'),
                    T('Method: k-means (large N, scalable); several random seeds, keep the lowest WCSS', '方法：k-means（N 大，可扩展）；多个随机种子，留 WCSS 最低的'),
                    T('Choose K by elbow and CH index over a range of K; check segments make sense to the business', '用肘部法和 CH 指数在一个 K 的范围内选 K；检查分群在业务上说得通'),
                    T('Judge: cohesion/separation (WCSS, BCSS, CH), inspect outliers; hierarchical is too costly at this N', '评价：凝聚度/分离度（WCSS、BCSS、CH），检查离群点；N 这么大，层次聚类开销太高')],
                   T('Scale the numeric features, one-hot encode the favourite category, and run k-means (scalable to 50,000 customers) with several random seeds, keeping the run with the lowest WCSS. Choose K with the elbow plot and the CH index over, say, K = 2 to 10. Evaluate by cohesion and separation (WCSS, BCSS, CH), look at outliers that distort centroids, and check that the segments are interpretable for the shop. Hierarchical clustering would need an N x N distance matrix, too costly here.',
                     'Scale the numeric features, one-hot encode the favourite category, and run k-means (scalable to 50,000 customers) with several random seeds, keeping the run with the lowest WCSS. Choose K with the elbow plot and the CH index over, say, K = 2 to 10. Evaluate by cohesion and separation (WCSS, BCSS, CH), look at outliers that distort centroids, and check that the segments are interpretable for the shop. Hierarchical clustering would need an N x N distance matrix, too costly here.'),
                   T('A design answer names the method and justifies each choice from the data.', '设计题的答案要给出方法，并从数据出发说明每个选择的理由。')),
            read('remember', T('What to remember', '要记住的'),
                 table([T('Topic', '主题'), T('Remember', '记住')],
                       [T('Clustering', '聚类'), T('no labels; five axes: exclusive/overlapping, hard/soft, hierarchical/partitioning, complete/partial, homogeneous/heterogeneous', '没有标签；五条轴：互斥/重叠、硬/软、层次/划分、完全/部分、同质/异质')],
                       [T('k-means', 'k-means'), T(r"seed, assign to nearest centroid, update to mean, repeat; normalise first; minimises $J$ = WCSS by coordinate descent, so it always stops, but at a local optimum", r"种子，分配到最近质心，更新为均值，重复；先规范化；对 $J$ = WCSS 做坐标下降，所以一定会停，但停在局部最优")],
                       [T('k-means limits', 'k-means 局限'), T('K given; seeds; outliers; non-spherical; different sizes and densities; no mean for categories', '要给定 K；依赖种子；离群点；非球形；大小和密度不同；类别没有均值')],
                       [T('Choosing K', '选 K'), T('elbow in the WCSS curve (never the minimum); CH index', 'WCSS 曲线的肘部（绝不是最小值）；CH 指数')],
                       [T('Linkages', '链接'), T('single = min (chains, sensitive to noise, non-elliptical OK); complete = max (compact, breaks large clusters); average = mean; centroid = centres (inversions)', '单链 = 取最小（串链、怕噪声、非椭圆也行）；全链 = 取最大（紧凑、拆大簇）；平均链 = 取平均；质心链 = 比质心（会倒挂）')],
                       [T('Hierarchical', '层次聚类'), T('no K needed (cut the dendrogram), no objective, merges cannot be undone', '不需要 K（切树状图），没有目标函数，合并不可撤销')],
                       [T('Evaluation', '评价'), T(r"$WCSS = \sum_j\sum_{i \in C_j}\lVert x_i - \mu_j\rVert^2$, $BCSS = \sum_j n_j\lVert \mu - \mu_j\rVert^2$, $WCSS + BCSS$ = const; $CH = \frac{BCSS}{WCSS}\cdot\frac{N-K}{K-1}$, higher is better", r"$WCSS = \sum_j\sum_{i \in C_j}\lVert x_i - \mu_j\rVert^2$，$BCSS = \sum_j n_j\lVert \mu - \mu_j\rVert^2$，$WCSS + BCSS$ 为常数；$CH = \frac{BCSS}{WCSS}\cdot\frac{N-K}{K-1}$，越高越好")])),
        ])


# ================================================================ semi-supervised and active learning: computations
def self_train_1nn(labelled, unlabelled, tau):
    """Self-training with 1-NN on a line: each round, every unlabelled point whose nearest labelled neighbour is within tau joins L."""
    L, U, rounds = dict(labelled), list(unlabelled), []
    while True:
        add = {}
        for u in U:
            d, lab = min((abs(u - x), l) for x, l in L.items())
            if d <= tau + 1e-9:
                add[u] = lab
        if not add:
            break
        L.update(add)
        U = [u for u in U if u not in add]
        rounds.append(add)
    return L, U, rounds


ST_U = [1.2, 2.4, 3.6, 4.8, 6.1, 7.3, 8.5, 9.7, 10.9]
ST_SEEDS = {0.0: 'A', 12.0: 'B'}
ST_TAU = 1.3
ST_L, ST_LEFT, ST_ROUNDS = self_train_1nn(ST_SEEDS, ST_U, ST_TAU)
truth_bad = lambda x: 'A' if x <= 3.0 else 'B'   # noqa: E731  the true boundary is far from the middle of the seeds
truth_good = lambda x: 'A' if x <= 6.0 else 'B'  # noqa: E731  the true boundary is where the seeds' geometry puts it
ST_WRONG_BAD = [u for u in ST_U if ST_L[u] != truth_bad(u)]
ST_WRONG_GOOD = [u for u in ST_U if ST_L[u] != truth_good(u)]


def entropy2(p):
    return -sum(x * math.log2(x) for x in p if x > 0)


def measures(p):
    """(max probability, margin, entropy in bits): the three uncertainty scores of one predicted distribution."""
    s = sorted(p, reverse=True)
    return s[0], s[0] - s[1], entropy2(p)


DOG = {'Left': (0.70, 0.05, 0.25), 'Middle': (0.45, 0.05, 0.50), 'Right': (0.34, 0.33, 0.33)}
FOUR = {'A': (0.60, 0.30, 0.05, 0.05), 'B': (0.48, 0.47, 0.04, 0.01), 'C': (0.40, 0.20, 0.20, 0.20), 'D': (0.37, 0.35, 0.20, 0.08)}
EXAM = {'x1': (0.2, 0.5, 0.3), 'x2': (0.3, 0.1, 0.6)}  # read off the bars of the deck's final-exam example (slide 40)


def vote_entropy(votes):
    n = sum(votes)
    return -sum(v / n * math.log2(v / n) for v in votes if v)


# ================================================================ semi-supervised and active learning: figures
def fig_selftrain(lang):
    f = Fig(780, 360, lang)
    x0, x1 = 100, 750
    sx = lambda v: x0 + v / 12 * (x1 - x0)  # noqa: E731
    rows = ['start'] + [f'r{i + 1}' for i in range(len(ST_ROUNDS))] + ['truth']
    lab_zh = {'start': '开始', 'truth': '真实'}
    state = dict(ST_SEEDS)
    for i, r in enumerate(rows):
        y = 34 + i * 48
        f.text(8, y + 6, f.L(r, lab_zh.get(r, f'第{r[1:]}轮')) if r in lab_zh or r == 'start' else f.L(f'round {r[1:]}', f'第 {r[1:]} 轮'), 15, MUTED)
        f.line(x0 - 6, y, x1 + 6, y, LINE, 1.5)
        if r.startswith('r'):
            state.update(ST_ROUNDS[int(r[1:]) - 1])
        for u in ST_U + list(ST_SEEDS):
            if r == 'truth':
                col = BLUE if truth_bad(u) == 'A' else ORANGE
                f.circle(sx(u), y, 8, fill=col, stroke=None)
            elif u in state:
                col = BLUE if state[u] == 'A' else ORANGE
                wrong = u in ST_U and state[u] != truth_bad(u)
                f.circle(sx(u), y, 8, fill=col, stroke=INK if wrong else None, sw=3)
            else:
                f.circle(sx(u), y, 8, fill='#ffffff', stroke='#9aa0a6', sw=1.6)
    f.text(sx(0), 344, 'A', 15, BLUE, 'middle')
    f.text(sx(12), 344, 'B', 15, ORANGE, 'middle')
    return f.svg()


def fig_al_loop(lang):
    f = Fig(720, 300, lang)
    boxes = [(30, 30, f.L('train model', '训练模型')), (270, 30, f.L('score the pool', '给未标注池打分')), (510, 30, f.L('query the most useful', '挑最有用的来问')),
             (510, 200, f.L('oracle labels it', '专家给标签')), (270, 200, f.L('add to L', '加入 L'))]
    for x, y, t in boxes:
        f.rect(x, y, 190, 64, fill='#ffffff', stroke=INK)
        f.text(x + 95, y + 38, t, 17, INK, 'middle')
    for (a, b) in ((0, 1), (1, 2), (2, 3), (3, 4)):
        ax, ay, _ = boxes[a]
        bx, by, _ = boxes[b]
        if ay == by:
            f.line(ax + 190 if bx > ax else ax, ay + 32, bx if bx > ax else bx + 190, by + 32, INK, 2, arrow=True)
        else:
            f.line(ax + 95, ay + 64, bx + 95, by, INK, 2, arrow=True)
    f.line(270, 232, 125, 232, INK, 2)
    f.line(125, 232, 125, 94, INK, 2, arrow=True)
    f.text(360, 290, f.L('repeat until the budget is spent', '重复，直到预算用完'), 16, MUTED, 'middle')
    return f.svg()


def fig_outlier(lang):
    rs = np.random.RandomState(2)
    f = Fig(640, 340, lang)
    sx = lambda v: 20 + v / 10 * 600  # noqa: E731
    sy = lambda v: 320 - v / 10 * 290  # noqa: E731
    f.line(sx(5), sy(0.2), sx(5), sy(9.8), MUTED, 2, '7 6')
    for c, col in (((2.4, 3.6), BLUE), ((7.6, 3.6), ORANGE)):
        for p in rs.normal(c, 0.55, (16, 2)):
            f.circle(sx(p[0]), sy(p[1]), 5, fill='#d9dce1', stroke=None)
        f.circle(sx(c[0]), sy(c[1] - 0.2), 7, fill=col, stroke=INK, sw=2)
    f.circle(sx(5), sy(8.4), 9, fill='#ffffff', stroke=ORANGE, sw=3)
    f.text(sx(5.3), sy(8.4) + 5, f.L('outlier, p = 0.5', '离群点，p = 0.5'), 16, ORANGE)
    f.circle(sx(4.8), sy(3.4), 9, fill='#ffffff', stroke=GREEN, sw=3)
    f.text(sx(5.2), sy(2.2), f.L('typical, p = 0.55', '典型点，p = 0.55'), 16, GREEN)
    f.text(sx(5) - 8, sy(9.6), f.L('boundary', '边界'), 16, MUTED, 'end')
    return f.svg()


# ================================================================ semi-supervised and active learning: the lesson
def L_semi():
    SS, ST, AL, AU = f'{SEMI}.setting', f'{SEMI}.selftrain', f'{SEMI}.active', f'{SEMI}.augment'
    ex_lines = []
    for name, pr in DOG.items():
        m = measures(pr)
        ex_lines.append((rf'{name}:\ \max P = {fmt(m[0], 2)},\quad \Delta = {fmt(m[1], 2)},\quad H = {fmt(m[2], 3)}',
                         T(rf"{name}: probabilities {pr}. Least confidence looks at the top probability {fmt(m[0], 2)}; margin $\Delta$ at the gap between the two largest, {fmt(sorted(pr)[-1], 2)} - {fmt(sorted(pr)[-2], 2)} = {fmt(m[1], 2)}; entropy at the whole distribution: $-\sum P\log_2 P = {fmt(m[2], 3)}$ bits.",
                           rf"{name}：概率 {pr}。最小置信度看最大的概率 {fmt(m[0], 2)}；边际 $\Delta$ 看最大和第二大的差，{fmt(sorted(pr)[-1], 2)} - {fmt(sorted(pr)[-2], 2)} = {fmt(m[1], 2)}；熵看整个分布：$-\sum P\log_2 P = {fmt(m[2], 3)}$ 比特。")))
    dm = {k: measures(v) for k, v in DOG.items()}
    ex = {k: measures(v) for k, v in EXAM.items()}
    fm = {k: measures(v) for k, v in FOUR.items()}
    pick_lc = min(fm, key=lambda k: fm[k][0])
    pick_mg = min(fm, key=lambda k: fm[k][1])
    pick_en = max(fm, key=lambda k: fm[k][2])
    assert (pick_lc, pick_mg, pick_en) == ('D', 'B', 'C')
    n_wrong = len(ST_WRONG_BAD)

    # self-training by hand, round by round
    st_lines = []
    for r, add in enumerate(ST_ROUNDS):
        pts = ', '.join(f'{fmt(u, 1)}\\to {ST_L[u]}' for u in add)
        wrong = [u for u in add if ST_L[u] != truth_bad(u)]
        say = T(rf"Round {r + 1}: apply 1-NN. A point joins L if its nearest labelled neighbour is within $\tau = {ST_TAU}$.",
                rf"第 {r + 1} 轮：用 1-NN 预测。如果最近的已标注点在 $\tau = {ST_TAU}$ 以内，这个点就加入 L。")
        if wrong:
            say = T(rf"Round {r + 1}: the nearest labelled neighbour of {fmt(wrong[0], 1)} is A at distance {fmt(wrong[0] - max([x for x, l in ST_SEEDS.items() if l == 'A'] + [u for rr in ST_ROUNDS[:r] for u in rr if rr[u] == 'A']), 1)}, no B point is within reach yet, so it is labelled A (but its true class is B).",
                    rf"第 {r + 1} 轮：{fmt(wrong[0], 1)} 最近的已标注点是 A，距离 {fmt(wrong[0] - max([x for x, l in ST_SEEDS.items() if l == 'A'] + [u for rr in ST_ROUNDS[:r] for u in rr if rr[u] == 'A']), 1)}，B 的点还够不着，所以它被标成 A（但它真实的类别是 B）。")
        st_lines.append((pts, say))
    st_lines.append((r'L \leftarrow L \cup \tilde{L}', T(r"$\tilde{L}$ stands for the pseudo-labelled points: they are now treated as ground truth in L. The process stops when L does not change.", r"伪标签的点现在在 L 里被当作真值。L 不再变化时，过程停止。")))

    return dict(
        id=lid(SEMI), title=T('Semi-supervised and active learning', '半监督学习与主动学习'),
        description=T('Learning when labels are scarce: self-training and why it can fail, the assumptions semi-supervised learning needs, active learning with uncertainty sampling and query by committee, and data augmentation.',
                      '标签稀缺时怎么学：自训练及其失败方式，半监督学习需要的假设，用不确定性采样和委员会查询的主动学习，以及数据增强。'),
        minutes=40,
        skills=[{'id': SS, 'name': T('The semi-supervised setting and its assumptions', '半监督的设定与假设')},
                {'id': ST, 'name': T('Self-training and confirmation bias', '自训练与确认偏差')},
                {'id': AL, 'name': T('Active learning and query strategies', '主动学习与查询策略')},
                {'id': AU, 'name': T('Data augmentation', '数据增强')}],
        misconceptions=[
            {'id': 'pseudo-true', 'description': T('Treating self-training pseudo-labels as reliable ground truth', '把自训练的伪标签当成可靠的真值')},
            {'id': 'ssl-always-helps', 'description': T('Believing unlabelled data always improves a classifier', '以为无标签数据一定能让分类器更好')},
            {'id': 'al-ssl-same', 'description': T('Confusing active learning (asks a human for true labels) with self-training (labels by itself)', '把主动学习（向人要真标签）和自训练（自己给标签）混为一谈')},
            {'id': 'uncertain-useful', 'description': T('Assuming the most uncertain instance is always the most useful one to label', '以为最不确定的实例一定最值得标注')},
            {'id': 'measures-agree', 'description': T('Assuming least confidence, margin and entropy always pick the same instance', '以为最小置信度、边际、熵总会选中同一个实例')}],
        steps=[
            read('why', T('Labels are the bottleneck', '标签才是瓶颈'),
                 p(T(r"Supervised learning is clear-cut but needs labels, and labels need human experts or special devices (and sometimes privacy rules make them hard to get). Unsupervised learning needs none but is often too noisy to interpret: it makes only as much sense as you can make of it. Yet unlabelled data is cheap and plentiful. The deck asks: what if we have **a little labelled data and a lot of unlabelled data**?",
                     r"监督学习清晰直接，但需要标签；标签要靠专家或专用设备（有时还有隐私限制）。无监督学习不需要标签，但结果常常太杂乱、难解释：你能读出多少意义，它就有多少意义。可没有标签的数据又便宜又多。课件问：如果**有一点点有标签的数据，和大量没标签的数据**呢？")),
                 table([T('If we have…', '如果我们有…'), T('Use', '用')],
                       [T('a little labelled + lots of unlabelled data', '少量有标签 + 大量无标签'), T('**semi-supervised learning** (self-training)', '**半监督学习**（自训练）')],
                       [T('a little labelled data + a budget to get more labels', '少量有标签 + 一笔预算去要更多标签'), T('**active learning**', '**主动学习**')],
                       [T('labelled data we can modify', '可以改造的有标签数据'), T('**data augmentation**', '**数据增强**')],
                       [T('a related unsupervised task to warm-start on', '一个相关的无监督任务来“热启动”'), T('**pre-training and fine-tuning** (the next lesson)', '**预训练与微调**（下一课）')]),
                 p(T(r"More data really does matter: for image classification, adding data is nearly as effective as adding layers, and more parameters do not help without more data (Sun et al., 2017, in the deck).",
                     r"数据多确实重要：对图像分类，增加数据几乎和增加层数一样有效，没有更多数据，更多参数也没用（课件引用的 Sun 等 2017）。")),
                 chapter=T('Using unlabelled data', '用上无标签数据')),
            read('setting', T('The semi-supervised setting', '半监督的设定'),
                 p(T(r"Let $L = \{(\mathbf{x}_i, y_i)\}_{i=1}^{l}$ be the labelled instances and $U = \{\mathbf{x}_i\}_{i=l+1}^{l+u}$ the unlabelled ones, often $|U| \gg |L|$. **Goal: learn a better classifier from $L \cup U$ than from $L$ alone.**",
                     r"设 $L = \{(\mathbf{x}_i, y_i)\}_{i=1}^{l}$ 是有标签的实例，$U = \{\mathbf{x}_i\}_{i=l+1}^{l+u}$ 是没标签的，通常 $|U| \gg |L|$。**目标：用 $L \cup U$ 学到比只用 $L$ 更好的分类器。**")),
                 p(T(r"A first idea: cluster all the data, give each cluster the most common label among its labelled members, and apply it to the unlabelled members. The deck calls it a bad idea, and asks why:",
                     r"第一个想法：把所有数据聚类，每个簇取其中已标注成员里最常见的标签，贴给该簇的无标注成员。课件说这是个坏主意，并追问为什么：")),
                 quiz(T('Why can "cluster, then majority-vote the label" go wrong?', '“先聚类，再按多数标签投票”为什么可能出错？'),
                      [(T('Clusters are found without labels, so a cluster can mix classes or cut one class in two; the vote then mislabels the minority members', '聚类时没用标签，一个簇可能混着几个类，或把一个类切成两半；投票就会把少数类的成员标错'), True),
                       (T('Clustering needs labels to start, which we do not have', '聚类开始时就需要标签，而我们没有'), T('Clustering needs no labels; that is exactly why it is usable here.', '聚类不需要标签；正因如此这里才能用。')),
                       (T('Majority voting always gives the right label', '多数投票总是给出正确的标签'), T('It gives the *most common* label in the cluster, which is wrong for every instance of another class in it.', '它给的是簇里*最常见*的标签，对簇内其他类的实例就是错的。'))],
                      T('It trusts that clusters equal classes. That trust is an assumption (next pages), not a fact.', '它相信“簇 = 类”。这种相信是一个假设（后面会讲），不是事实。')),
                 p(T(r"A better idea keeps the classifier in charge: **self-training**.", r"更好的做法是让分类器自己做主：**自训练**。"))),
            read('selftrain', T('Self-training: the model labels its own data', '自训练：模型给自己的数据打标签'),
                 p(T(r"Self-training (also called bootstrapping) solves a problem without external resources. Start with $L$ and $U$, then repeat:", r"自训练（又叫 bootstrapping）不借助外部资源来解决问题。从 $L$ 和 $U$ 出发，重复：")),
                 ol(T(r"Train a model $f$ on $L$ with any supervised method.", r"用任意监督方法在 $L$ 上训练模型 $f$。"),
                    T(r"Apply $f$ to every instance in $U$.", r"用 $f$ 预测 $U$ 里每个实例。"),
                    T(r"Pick the subset of $U$ with **high-confidence** predictions.", r"挑出 $U$ 里预测**置信度高**的那部分。"),
                    T(r"Move it from $U$ to $L$, with the model's predictions (**pseudo-labels**) as if they were ground truth.", r"把它们从 $U$ 移到 $L$，把模型的预测（**伪标签**）当作真值。"),
                    T(r"Stop when $L$ does not change.", r"$L$ 不再变化时停止。")),
                 p(T(r"What counts as high confidence depends on the model. These are the deck's two examples:", r"什么算“高置信度”取决于模型。课件给了两个例子：")),
                 table([T('Model', '模型'), T('Confident when…', '什么时候算置信')],
                       [T('1-NN', '1-NN'), T(r"the nearest labelled neighbour is closer than a distance $\tau$", r"最近的已标注点比距离 $\tau$ 更近")],
                       [T('Naive Bayes', '朴素贝叶斯'), T(r"the predicted class probability is above a threshold, or among the top $N$ most confident", r"预测的类别概率高于阈值，或属于最有把握的前 $N$ 个")]),
                 p(T(r"The threshold is the **safety net**: classification errors can propagate, so do not add to $L$ when confidence falls below it. It rests on one assumption: *points that are nearby (similar) are likely to have the same label*.",
                     r"这个阈值是**安全网**：分类错误会传播，所以置信度低于它时就不要加入 $L$。整个做法建立在一个假设上：*彼此靠近（相似）的点很可能有相同的标签*。")),
                 chapter=T('Self-training', '自训练')),
            derive('st-hand', T('Self-training with 1-NN by hand', '用 1-NN 手算一次自训练'), st_lines,
                   intro=T(rf"One-dimensional data. Labelled: A at 0 and B at 12. Unlabelled: {', '.join(fmt(u, 1) for u in ST_U)}. Threshold $\tau = {ST_TAU}$.", rf"一维数据。有标签：0 处是 A，12 处是 B。无标签：{', '.join(fmt(u, 1) for u in ST_U)}。阈值 $\tau = {ST_TAU}$。"),
                   outro=T(r"Points up to 4.8 are labelled A and the rest B: labels spread inward from the seeds, one hop per round. The truth in this example puts the class boundary at 3, not at the middle.", r"4.8 及其左边的点全标成 A，其余标成 B：标签从种子向中间一圈圈地传，每轮走一步。这个例子里真实的类别边界在 3，不在正中间。"),
                   skill=ST),
            read('st-picture', T('The picture of the run', '这次运行的全貌'),
                 svg(drawn(fig_selftrain), T('Nine rows of points on a line. Start: only 0 (A, blue) and 12 (B, orange) coloured. Each following row colours the next points inward from both ends. Last row: the true classes, where B starts at 3.6. Two points, 3.6 and 4.8, are outlined because they were labelled A wrongly.',
                                              '一条线上的点，共九行。开始：只有 0（A，蓝）和 12（B，橙）有颜色。之后每一行从两端向里多上色几个点。最后一行是真实类别，B 从 3.6 开始。3.6 和 4.8 被描了黑边，因为它们被错标成了 A。'),
                     T(r"Each round extends the labels by one hop. Black outline: a pseudo-label that is wrong.", r"每轮把标签延伸一步。黑色描边：错误的伪标签。")),
                 p(T(rf"The method did exactly what it was told, and {n_wrong} of the {len(ST_U)} pseudo-labels are wrong. Read the same run with a different truth, the true boundary at 6 instead of 3, and **all {len(ST_U)} are right**. The procedure never looks at the truth: whether it helps depends only on whether the geometry it follows matches the true labels.",
                     rf"方法完全照指令办事，{len(ST_U)} 个伪标签里有 {n_wrong} 个是错的。同一次运行，如果真实边界在 6 而不是 3，**{len(ST_U)} 个全对**。这个过程从来不看真值：它有没有帮助，只取决于它所依循的几何结构是否和真实标签一致。"))),
            read('assumptions', T('What unlabelled data can tell us: three assumptions', '无标签数据能告诉我们什么：三个假设'),
                 p(T(r"Unlabelled points carry no label, only their position. They can help only if position says something about labels. Textbooks (Chapelle et al., *Semi-Supervised Learning*; Zhu's survey, cited in the deck) name the assumptions:",
                     r"无标签的点没有标签，只有位置。只有当位置能说明一些标签的信息时，它们才有帮助。教材（Chapelle 等的 *Semi-Supervised Learning*，课件引用的 Zhu 综述）给出这几条假设：")),
                 table([T('Assumption', '假设'), T('Says', '含义'), T('Method that uses it', '依赖它的方法')],
                       [T('Smoothness', '平滑性'), T('nearby points in a dense region have the same label', '稠密区域里靠近的点标签相同'), T('self-training (1-NN: nearby = same label)', '自训练（1-NN：靠近 = 同标签）')],
                       [T('Cluster', '聚类'), T('points in the same cluster share a label; the boundary lies in low-density gaps', '同一个簇里的点标签相同；边界在低密度的缝隙里'), T('clustering + majority vote', '聚类 + 多数投票')],
                       [T('Manifold', '流形'), T('high-dimensional data lies near a low-dimensional surface; labels vary smoothly along it', '高维数据落在低维曲面附近；标签沿曲面平滑变化'), T('graph-based methods, label propagation (textbook, not in the deck)', '基于图的方法，标签传播（教材内容，课件没讲）')]),
                 quiz(T('Two classes overlap heavily in feature space (no low-density gap between them). What do you expect from adding unlabelled data?', '两个类在特征空间里严重重叠（它们之间没有低密度缝隙）。加入无标签数据你预期会怎样？'),
                      [(T('It helps a lot, because more data is always better', '帮助很大，因为数据总是越多越好'), T('More *labelled* data helps; unlabelled data helps only if its geometry says something about labels, and here it does not.', '更多*有标签*的数据有用；无标签数据只有在几何结构能说明标签时才有用，这里不行。'), 'ssl-always-helps'),
                       (T('It may not help, and can hurt: pseudo-labels follow the geometry, which does not match the classes', '可能没帮助，甚至有害：伪标签沿着几何结构走，而它和类别并不一致'), True),
                       (T('It cannot change anything, since unlabelled points have no labels', '什么也改变不了，因为无标签点没有标签'), T('It can change the model: pseudo-labels enter L. That is the risk.', '它能改变模型：伪标签会进入 L。这正是风险所在。'))],
                      T('Semi-supervised learning is only as good as its assumption.', '半监督学习的好坏取决于它的假设。'))),
            read('bias', T('Deeper: confirmation bias, the failure mode of self-training', '深入：确认偏差，自训练的失败方式'),
                 p(T(r"Self-training feeds a model its own outputs. A pseudo-label is the model's opinion, not evidence; once it sits in $L$ it is **treated as truth**, the next model is trained on it, and the next round is more confident about the same mistake. Errors are not corrected, they are *reinforced*.",
                     r"自训练把模型自己的输出再喂给它。伪标签是模型的意见，不是证据；一旦进了 $L$ 就被**当成真值**，下一个模型据此训练，下一轮对同一个错误更有信心。错误不但没被纠正，反而被*强化*。")),
                 ul(T(r"**Why a threshold helps only a little.** Confidence is computed by the very model that may be wrong. Naive Bayes in particular is badly over-confident (it multiplies many features it wrongly treats as independent), so its \"high confidence\" predictions include many errors.", r"**阈值为什么帮助有限。** 置信度是由可能出错的那个模型自己算的。朴素贝叶斯尤其过于自信（它把许多特征错误地当作独立再连乘），所以它的“高置信度”预测里混着很多错误。"),
                    T(r"**Errors become stepping stones.** In the run above, 3.6 is wrongly labelled A in round 3. In round 4, 4.8 is labelled A *because* 3.6 is now in $L$ at distance 1.2. Without the earlier error, no A point would have been within reach of 4.8.", r"**错误变成垫脚石。** 上面那次运行里，3.6 在第 3 轮被错标成 A。第 4 轮 4.8 被标成 A，*正是因为* 3.6 此时已在 $L$ 中、相距 1.2。如果没有前面那个错误，4.8 附近就没有 A 点够得着它。"),
                    T(r"**Unrepresentative seeds.** A tiny $L$ may not show where the classes really meet, and self-training then spreads that blind spot.", r"**种子没有代表性。** 很小的 $L$ 可能看不出类别真正的交界，自训练会把这个盲区扩散出去。")),
                 table([T('Helps when…', '什么时候有帮助'), T('Hurts when…', '什么时候有害')],
                       [T('the classes form separated clusters (the cluster / smoothness assumption holds)', '各类形成彼此分开的簇（聚类/平滑假设成立）'), T('classes overlap, or the true boundary cuts through a dense region', '类别重叠，或真实边界穿过稠密区域')],
                       [T('the first labelled points are representative and the first pseudo-labels are right', '最初的标注点有代表性，最初的伪标签是对的'), T('early pseudo-labels are wrong: nothing in the loop corrects them', '早期伪标签是错的：循环里没有任何东西会纠正它们')],
                       [T('the threshold is strict (few but reliable pseudo-labels)', '阈值严格（伪标签少但可靠）'), T('the threshold is lax, or the model is over-confident', '阈值宽松，或模型过于自信')]),
                 quiz(T('Which change makes self-training safer?', '哪种改动能让自训练更安全？'),
                      [(T('Lower the confidence threshold so more points join L each round', '降低置信度阈值，让每轮有更多点加入 L'), T('That admits more uncertain predictions, the ones most likely to be wrong.', '这会放进更多不确定的预测，恰恰是最可能错的。'), 'pseudo-true'),
                       (T('Raise the threshold, accept fewer but more confident pseudo-labels, and check against held-out labelled data', '提高阈值，只收更少但更有把握的伪标签，并用留出的有标签数据检验'), True),
                       (T('Retrain only once, at the end', '只在最后重新训练一次'), T('That is no longer self-training; the model would not benefit from pseudo-labels at all.', '那就不再是自训练了；模型根本得不到伪标签的好处。'))],
                      T('Strict thresholds and a clean validation set are the usual protection.', '严格的阈值加一份干净的验证集是常见的保护措施。'))),
            # ---------------------------------------------------------------- active learning
            read('active', T('Active learning: ask for the labels that matter', '主动学习：只问最关键的标签'),
                 p(T(r"Self-training spends no money and so trusts its own guesses. **Active learning** has a budget to ask someone (the **oracle**, e.g. a human annotator) for true labels. The hypothesis: a classifier reaches higher accuracy with fewer labelled instances if it may choose which ones. Labelling is a finite resource, so spend it where it improves the model most.",
                     r"自训练一分钱不花，所以只能相信自己的猜测。**主动学习**则有一笔预算，可以去问某个人（**专家** oracle，比如人工标注员）要真标签。假设是：如果分类器能自己挑选要标哪些实例，就能用更少的标注达到更高的准确率。标注是有限资源，应该花在最能改进模型的地方。")),
                 svg(drawn(fig_al_loop), T('A cycle of five boxes: train model, score the pool, query the most useful, oracle labels it, add to L, and back to train model.', '五个方框组成的循环：训练模型、给未标注池打分、挑最有用的来问、专家给标签、加入 L，再回到训练模型。'),
                     T(r"The loop: the model chooses, the human answers.", r"循环：模型来挑，人来答。")),
                 table(['', T('Semi-supervised (self-training)', '半监督（自训练）'), T('Active learning', '主动学习')],
                       [T('Where new labels come from', '新标签来源'), T('the model itself (pseudo-labels, can be wrong)', '模型自己（伪标签，可能错）'), T('an oracle (true labels, cost money)', '专家（真标签，要花钱）')],
                       [T('Which instances', '选哪些实例'), T('the ones the model is *most* sure about', '模型*最*有把握的'), T('the ones the model is *least* sure about', '模型*最*没把握的')]),
                 p(T(r"How can the learner meet instances to query? Three scenarios (Settles, 2010, the survey cited in the deck): **pool-based** (a big unlabelled pool, rank and pick the best), **stream-based** (instances arrive one at a time; decide on the spot whether to ask), and **query synthesis** (the learner constructs a new instance to ask about). The strategies below are written for the pool-based case.",
                     r"学习者怎样遇到可以查询的实例？三种场景（Settles 2010，课件引用的综述）：**基于池**（pool-based，一大池无标注数据，排序挑最好的）、**基于流**（stream-based，实例一个个来，当场决定要不要问）、**查询合成**（query synthesis，学习者自己构造一个新实例来问）。下面的策略按基于池的情形来写。")),
                 p(T(r"Which to choose? Instances on which the model is highly uncertain (near the class boundaries), or in sparse label regions where there is not enough data.", r"该选哪些？模型高度不确定的实例（靠近类别边界），或者标签稀少、数据不足的区域里的实例。")),
                 chapter=T('Active learning', '主动学习')),
            read('uncertainty', T('Uncertainty sampling: three ways to say "unsure"', '不确定性采样：“没把握”的三种说法'),
                 p(T(r"The model gives class probabilities $P(y \mid \mathbf{x})$. Query the instance where they look most undecided. Three scores:", r"模型给出类别概率 $P(y \mid \mathbf{x})$。去问概率看上去最拿不定主意的那个实例。三种打分：")),
                 table([T('Strategy', '策略'), T('Query', '查询'), T('Looks at', '看什么')],
                       [T('Least confidence', '最小置信度'), T(r"$\mathbf{x}^* = \arg\min_{\mathbf{x}} \max_y P(y \mid \mathbf{x})$", r"$\mathbf{x}^* = \arg\min_{\mathbf{x}} \max_y P(y \mid \mathbf{x})$"), T('only the top probability: low = unsure', '只看最大概率：低 = 没把握')],
                       [T('Margin', '边际'), T(r"$\mathbf{x}^* = \arg\min_{\mathbf{x}} \big(P(y_1 \mid \mathbf{x}) - P(y_2 \mid \mathbf{x})\big)$", r"$\mathbf{x}^* = \arg\min_{\mathbf{x}} \big(P(y_1 \mid \mathbf{x}) - P(y_2 \mid \mathbf{x})\big)$"), T('the gap between the top two classes: small = torn between two', '最大的两个类之间的差：小 = 在两个类之间摇摆')],
                       [T('Entropy', '熵'), T(r"$\mathbf{x}^* = \arg\max_{\mathbf{x}} \big(-\sum_y P(y \mid \mathbf{x}) \log_2 P(y \mid \mathbf{x})\big)$", r"$\mathbf{x}^* = \arg\max_{\mathbf{x}} \big(-\sum_y P(y \mid \mathbf{x}) \log_2 P(y \mid \mathbf{x})\big)$"), T('the whole distribution: high = spread out', '整个分布：高 = 很分散')]),
                 p(T(r"Here $y_1, y_2$ are the most and second most probable classes. Note the directions: least confidence and margin **minimise**, entropy **maximises**. Each is a different answer to \"how undecided is this distribution\"; the next pages compute all three.",
                     r"这里 $y_1, y_2$ 是概率最大和第二大的类。注意方向：最小置信度和边际是**取最小**，熵是**取最大**。三者是对“这个分布有多拿不定主意”的三种回答；下几页把它们都算一遍。"))),
            derive('unc-hand', T('The deck\'s cat / dog / pig example', '课件里的猫 / 狗 / 猪例子'), ex_lines,
                   intro=T(r"Three instances, each with predicted probabilities for (cat, dog, pig). Which is the most uncertain?", r"三个实例，各有对（猫、狗、猪）的预测概率。哪个最不确定？"),
                   outro=T(rf"Least confidence picks **Right** (max {fmt(dm['Right'][0], 2)}, the lowest). Margin picks **Right** (gap {fmt(dm['Right'][1], 2)}). Entropy picks **Right** ({fmt(dm['Right'][2], 3)} bits, close to the maximum $\log_2 3 = {fmt(math.log2(3), 3)}$). The deck ranks the entropy Low, Medium, High for Left, Middle, Right: {fmt(dm['Left'][2], 2)}, {fmt(dm['Middle'][2], 2)}, {fmt(dm['Right'][2], 2)}.",
                           rf"最小置信度选 **Right**（最大概率 {fmt(dm['Right'][0], 2)}，最低）。边际选 **Right**（差 {fmt(dm['Right'][1], 2)}）。熵选 **Right**（{fmt(dm['Right'][2], 3)} 比特，接近最大值 $\log_2 3 = {fmt(math.log2(3), 3)}$）。课件把 Left、Middle、Right 的熵标为低、中、高：{fmt(dm['Left'][2], 2)}、{fmt(dm['Middle'][2], 2)}、{fmt(dm['Right'][2], 2)}。"),
                   skill=AL),
            derive('exam-d', T('The final-exam example: x1 or x2?', '期末考例题：x1 还是 x2？'),
                   [(rf'x_1:\ (P(Y{{=}}1), P(Y{{=}}2), P(Y{{=}}3)) \approx {EXAM["x1"]}', T(r"The bar chart in the deck shows probabilities for each instance over three classes. Reading the bars (to about 0.05): $x_1 \approx (0.2, 0.5, 0.3)$.", r"课件里的柱状图给出每个实例在三个类上的概率。读柱高（精确到约 0.05）：$x_1 \approx (0.2, 0.5, 0.3)$。")),
                    (rf'x_2:\ (P(Y{{=}}1), P(Y{{=}}2), P(Y{{=}}3)) \approx {EXAM["x2"]}', T(r"Likewise $x_2 \approx (0.3, 0.1, 0.6)$.", r"同样，$x_2 \approx (0.3, 0.1, 0.6)$。")),
                    (rf'x_1: 0.5 - 0.3 = {fmt(ex["x1"][1], 2)}', T(r"Margin sampling: the gap between the top two classes. For $x_1$ the top two are class 2 (0.5) and class 3 (0.3).", r"边际采样：最大的两个类的概率之差。$x_1$ 的前两名是类 2（0.5）和类 3（0.3）。")),
                    (rf'x_2: 0.6 - 0.3 = {fmt(ex["x2"][1], 2)}', T(r"For $x_2$ the top two are class 3 (0.6) and class 1 (0.3).", r"$x_2$ 的前两名是类 3（0.6）和类 1（0.3）。")),
                    (rf'{fmt(ex["x1"][1], 2)} < {fmt(ex["x2"][1], 2)} \Rightarrow x_1', T(r"The smaller margin means the model is closer to a coin flip between two classes, so the label of $x_1$ is more informative.", r"边际更小，说明模型在两个类之间更接近抛硬币，所以 $x_1$ 的标签信息量更大。"))],
                   intro=T(r"This is question (d) of a past exam (4 marks): (i) describe the motivation behind active learning, (ii) say which instance margin sampling queries, and explain.", r"这是一道往年考题（第 (d) 问，4 分）：(i) 说明主动学习的动机；(ii) 按边际采样，选哪个实例去标注，并解释。"),
                   outro=T(rf"**Answer:** query $x_1$ (margin {fmt(ex['x1'][1], 2)} against {fmt(ex['x2'][1], 2)}). For comparison, least confidence gives the same choice (max {fmt(ex['x1'][0], 2)} against {fmt(ex['x2'][0], 2)}) and so does entropy ({fmt(ex['x1'][2], 2)} against {fmt(ex['x2'][2], 2)} bits). The motivation (i): labels are scarce and costly, so let the learner choose the instances whose labels improve it most.",
                           rf"**答案：** 查询 $x_1$（边际 {fmt(ex['x1'][1], 2)}，对 {fmt(ex['x2'][1], 2)}）。作比较：最小置信度同样选它（最大概率 {fmt(ex['x1'][0], 2)} 对 {fmt(ex['x2'][0], 2)}），熵也一样（{fmt(ex['x1'][2], 2)} 对 {fmt(ex['x2'][2], 2)} 比特）。(i) 的动机：标签稀缺而昂贵，所以让学习者自己选择那些标签最能改进它的实例。"),
                   skill=AL),
            read('disagree', T('Deeper: the three measures can disagree', '深入：三种度量可能意见不一'),
                 p(T(r"The deck's last example has four points and four classes (cat, dog, pig, cow). Fill in the three columns:", r"课件最后一个例子有四个点、四个类（猫、狗、猪、牛）。把三列填出来：")),
                 table([T('Point', '点'), T('P(cat, dog, pig, cow)', 'P(猫, 狗, 猪, 牛)'), T('max P', '最大 P'), T('margin', '边际'), T('entropy (bits)', '熵（比特）')],
                       *[[k, str(v), fmt(fm[k][0], 2), fmt(fm[k][1], 2), fmt(fm[k][2], 3)] for k, v in FOUR.items()]),
                 p(T(rf"Three measures, **three different winners**: least confidence queries **{pick_lc}** (lowest top probability, {fmt(fm[pick_lc][0], 2)}), margin queries **{pick_mg}** (gap {fmt(fm[pick_mg][1], 2)}), entropy queries **{pick_en}** (the flattest distribution, {fmt(fm[pick_en][2], 3)} bits).",
                     rf"三种度量，**三个不同的赢家**：最小置信度选 **{pick_lc}**（最大概率最低，{fmt(fm[pick_lc][0], 2)}），边际选 **{pick_mg}**（差 {fmt(fm[pick_mg][1], 2)}），熵选 **{pick_en}**（分布最平，{fmt(fm[pick_en][2], 3)} 比特）。")),
                 p(T(r"Why? Take B and C. B is torn between two classes (0.48 against 0.47) and nearly sure the other two are wrong. C has no idea at all: 0.40, then three almost equal. Least confidence and entropy see C as the more uncertain; margin sees B, because the margin looks only at the two leaders and C has a clear leader (0.40 against 0.20).",
                     r"为什么？看 B 和 C。B 在两个类之间摇摆（0.48 对 0.47），几乎肯定另外两个类不对。C 则完全没主意：0.40，其余三个几乎相等。最小置信度和熵认为 C 更不确定；边际认为是 B，因为边际只看前两名，而 C 有一个明确的领先者（0.40 对 0.20）。")),
                 ul(T(r"**Least confidence** ignores everything but the top probability.", r"**最小置信度**只看最大概率，别的都不管。"),
                    T(r"**Margin** ignores everything except the top two: best when the trouble is choosing between two classes.", r"**边际**只看前两名：问题出在两个类之间难取舍时最合适。"),
                    T(r"**Entropy** uses the whole distribution: best when the trouble is a flat spread over many classes. With two classes all three agree.", r"**熵**用整个分布：问题是概率平摊在很多类上时最合适。只有两个类时三者结论一致。")),
                 quiz(T('With only two classes, can least confidence and margin sampling ever disagree?', '只有两个类时，最小置信度和边际采样会不会出现分歧？'),
                      [(T('Yes, margin can pick a different instance', '会，边际可能选不同的实例'), T('With two classes the top two probabilities are $p$ and $1 - p$, so margin $= 2p - 1$, a rising function of the max: same ranking.', '两个类时前两名是 $p$ 和 $1 - p$，边际 $= 2p - 1$，是最大概率的增函数：排序相同。'), 'measures-agree'),
                       (T('Never: margin = 2 max P - 1, so they rank instances identically', '不会：边际 = 2·最大P - 1，排序完全相同'), True),
                       (T('Only when the probabilities are exactly 0.5', '只有概率正好是 0.5 时'), T('At 0.5 they tie; away from it they agree on the order.', '0.5 时是平局；其余情况顺序一致。'))],
                      T('The disagreement needs three or more classes.', '要出现分歧，至少需要三个类。'))),
            read('qbc', T('Query by committee', '委员会查询'),
                 p(T(r"A different idea of uncertainty: keep a **committee** of models, all trained on the same labelled data but in different ways (different algorithms, or different random subsets). Each instance in the pool is voted on; query the one the committee **disagrees** on most. The reasoning: if trained models disagree, the data so far does not settle the answer, so one more label is worth a lot.",
                     r"另一种不确定性的想法：维护一个**委员会**，里面是用同一批有标签数据、但用不同方式训练的多个模型（不同算法，或不同随机子集）。对池里每个实例让委员会投票；去问**分歧最大**的那个。道理是：如果训练好的模型意见不一，说明目前的数据还定不下答案，多一个标签就很值钱。")),
                 math_(r'VE(\mathbf{x}) = -\sum_{c} \frac{V(c)}{C} \log_2 \frac{V(c)}{C}'),
                 p(T(r"**Vote entropy**: $C$ is the committee size and $V(c)$ the number of members voting class $c$. It is the entropy of the vote shares: 0 when everyone agrees, largest when the votes are spread evenly.",
                     r"**投票熵**（vote entropy）：$C$ 是委员会人数，$V(c)$ 是投类 $c$ 的成员数。它是投票比例的熵：全体一致时为 0，票数平均分散时最大。")),
                 table([T('Votes of 5 members for (class 1, 2, 3)', '5 位成员对（类 1, 2, 3）的票数'), T('Vote entropy (bits)', '投票熵（比特）')],
                       *[[str(v), fmt(vote_entropy(v), 3)] for v in ((5, 0, 0), (3, 2, 0), (2, 2, 1))]),
                 p(T(r"So the committee queries the instance voted (2, 2, 1). Compared with uncertainty sampling it needs several models, but it does not rely on one model's probabilities, which may be badly calibrated.",
                     r"所以委员会会去查票数是 (2, 2, 1) 的那个实例。和不确定性采样相比，它需要多个模型，但不依赖单个模型的概率（那些概率可能校准得很差）。"))),
            read('outliers', T('Deeper: why uncertainty sampling can pick outliers', '深入：不确定性采样为什么会选中离群点'),
                 p(T(r"A model is uncertain wherever its probabilities hover near 0.5. That is not only near the training data. A linear classifier extends its boundary forever, so a point far out, in a region with **no data at all**, can have the same predicted probability as a point on the boundary inside a busy region.",
                     r"模型在概率接近 0.5 的地方就是不确定的。这不只发生在训练数据附近。线性分类器会把边界无限延伸，所以远处一个**根本没有数据**的区域里的点，预测概率可以和繁忙区域边界上的点一样。")),
                 svg(drawn(fig_outlier), T('Two grey clouds of unlabelled points with one labelled point each, blue on the left and orange on the right, a dashed vertical boundary between them. A typical point near the boundary, among the data, and an outlier high above all data on the boundary line, both with probability about 0.5.',
                                           '两团灰色的无标注点，各有一个已标注点，左边蓝、右边橙，中间一条竖直虚线是边界。一个典型点在数据之间靠近边界，一个离群点在所有数据上方的边界线上，两者的概率都约为 0.5。'),
                     T(r"Both are uncertain. Only one is worth a label.", r"两个都不确定。只有一个值得标。")),
                 p(T(r"Labelling the outlier teaches the model about a place where almost no future instance will ever fall; labelling the typical point teaches it about the region where the data is. A label there also *propagates*: it is informative about many neighbours. Uncertainty sampling alone cannot tell them apart, which is why the deck warns that it \"can select outliers or noise\".",
                     r"标注离群点，教给模型的是一个几乎不会有未来实例落入的地方；标注典型点，教给它的是数据所在的区域，而且这个标签还会*传播*：它对许多邻居都有信息。光靠不确定性采样分不出两者，所以课件警告它“会选中离群点或噪声”。")),
                 ul(T(r"**Fix: density weighting** (textbook, Settles 2010): multiply the uncertainty by how representative the point is, for example its average similarity to the rest of the pool. An outlier then scores low however uncertain it is.", r"**对策：密度加权**（教材，Settles 2010）：把不确定性乘上这个点的代表性，例如它与池里其他点的平均相似度。这样离群点不管多不确定，得分都低。"),
                    T(r"**Other cares from the deck:** the theory behind active learning is still elusive (empirically it is robust). And it introduces **bias**: the labelled set is chosen by the model, so it no longer follows the true label distribution (near-boundary points are over-represented), which matters when you evaluate or reuse it.", r"**课件提到的其他注意点：** 主动学习背后的理论仍然难以确立（经验上它很稳健）。它还会引入**偏差**：有标签的集合是由模型挑出来的，不再服从真实的标签分布（靠近边界的点被过多代表），评估或复用它时要小心。")),
                 table([T('Active learning: pros', '主动学习的优点'), T('Cons', '缺点')],
                       [T('fewer labels for the same accuracy; labelling effort goes where it matters', '同样的准确率需要更少的标注；标注精力花在刀刃上'), T('sampling bias: labelled data no longer follows the true distribution', '采样偏差：有标签数据不再服从真实分布')],
                       [T('works with any model that gives uncertainty scores', '任何能给出不确定性打分的模型都能用'), T('may query outliers or noise; needs a human in the loop each round', '可能查到离群点或噪声；每一轮都需要人参与')])),
            read('augment', T('Data augmentation: make more of the labelled data', '数据增强：把有标签的数据变多'),
                 p(T(r"If we can modify the labelled data, add a small amount of \"noise\" to each instance to create variations, **keeping the label**. The perturbations should be the kind of variation you expect in real data.",
                     r"如果可以改造有标签的数据，就给每个实例加一点“噪声”造出变体，**标签保持不变**。这些扰动应该是真实数据里本来就会出现的那类变化。")),
                 table([T('Data', '数据'), T('Typical perturbations', '常见扰动')],
                       [T('Images', '图像'), T('brightness, flip left-right, shift, resize, rotate', '亮度、左右翻转、平移、缩放、旋转')],
                       [T('Audio', '音频'), T('volume, shift in time, frequencies', '音量、时间平移、频率')],
                       [T('Text', '文本'), T('synonym substitution, translate to another language and back', '同义词替换、翻译到另一种语言再翻回来')]),
                 table([T('Advantages', '优点'), T('Disadvantages', '缺点')],
                       [T('more data nearly always improves learning', '更多数据几乎总能改善学习'), T('biased training data', '训练数据有偏')],
                       [T('most learners are robust to some noise', '多数学习算法对一定噪声有鲁棒性'), T('may introduce features that do not exist in the real world', '可能引入真实世界里不存在的特征')],
                       ['', T('may propagate errors; hurts interpretability and transparency', '可能传播错误；损害可解释性与透明度')]),
                 quiz(T('Which augmentation is risky for classifying handwritten digits?', '给手写数字分类时，哪种增强有风险？'),
                      [(T('Shift the image by two pixels', '把图像平移两个像素'), T('A shifted 7 is still a 7.', '平移后的 7 还是 7。')),
                       (T('Rotate by a small angle', '旋转一个小角度'), T('Small rotations occur in real handwriting.', '小角度旋转在真实手写里就会出现。')),
                       (T('Rotate by 180 degrees', '旋转 180 度'), True)],
                      T('A 6 rotated by 180 degrees looks like a 9: the perturbation changes the label.', '6 旋转 180 度看起来像 9：这个扰动改变了标签。')),
                 p(T(r"Pre-training on a related self-supervised task, then fine-tuning, is the fourth remedy on the deck's list; it is the next lesson.", r"在相关的自监督任务上预训练、再微调，是课件列表里的第四种办法；那是下一课的内容。"))),

            # ---------------------------------------------------------------- practice
            number('q-entropy', T('Entropy of a prediction', '预测的熵'), AL,
                   T(r"A classifier predicts $(0.5, 0.25, 0.25)$ for an unlabelled instance. Compute the entropy in bits. Round to 2 decimal places.", r"分类器对一个无标签实例预测 $(0.5, 0.25, 0.25)$。计算熵（比特），保留 2 位小数。"),
                   entropy2((0.5, 0.25, 0.25)), T(r"$-(0.5\log_2 0.5 + 2 \times 0.25\log_2 0.25) = 0.5 + 2 \times 0.5 = 1.5$ bits.", r"$-(0.5\log_2 0.5 + 2 \times 0.25\log_2 0.25) = 0.5 + 2 \times 0.5 = 1.5$ 比特。"), tolerance=0.01, chapter=T('Exam practice', '考试练习')),
            number('q-margin', T('Margin', '边际'), AL,
                   T(r"Instance P has predictions $(0.55, 0.30, 0.15)$ and instance Q has $(0.45, 0.44, 0.11)$. What is the margin of Q?", r"实例 P 的预测是 $(0.55, 0.30, 0.15)$，实例 Q 是 $(0.45, 0.44, 0.11)$。Q 的边际是多少？"),
                   0.01, T(r"Top two of Q: $0.45 - 0.44 = 0.01$. P's margin is 0.25, so margin sampling picks Q; least confidence also picks Q (max 0.45 < 0.55).", r"Q 的前两名：$0.45 - 0.44 = 0.01$。P 的边际是 0.25，所以边际采样选 Q；最小置信度也选 Q（最大 0.45 < 0.55）。"), tolerance=0.005),
            choice('q-pick', T('Which instance is queried?', '该查询哪个实例？'), AL,
                   T(r"Use points B $(0.48, 0.47, 0.04, 0.01)$ and C $(0.40, 0.20, 0.20, 0.20)$. Which does **margin sampling** query?", r"用点 B $(0.48, 0.47, 0.04, 0.01)$ 和 C $(0.40, 0.20, 0.20, 0.20)$。**边际采样**会查哪个？"),
                   [(T('B, margin 0.01', 'B，边际 0.01'), True),
                    (T('C, because its top probability 0.40 is lower', 'C，因为它的最大概率 0.40 更低'), T('That is least confidence. Margin compares the top two: B has 0.01, C has 0.20.', '那是最小置信度的逻辑。边际比较的是前两名：B 是 0.01，C 是 0.20。'), 'measures-agree'),
                    (T('C, because its entropy is higher', 'C，因为它的熵更高'), T('That is entropy sampling. Margin ignores the rest of the distribution.', '那是熵采样。边际不管分布的其余部分。'), 'measures-agree')],
                   T('Margin looks only at the two leading classes.', '边际只看领先的两个类。'), purpose='check'),
            choice('q-self', T('Self-training or active learning?', '自训练还是主动学习？'), SS,
                   T(r"A hospital has 200 labelled scans and 50,000 unlabelled ones. Radiologists can label 100 more scans. Which statement is correct?", r"一家医院有 200 张有标签的扫描和 5 万张无标签的。放射科医生还能再标 100 张。哪句话对？"),
                   [(T('Active learning picks the 100 scans to send to the radiologists; self-training would use the model\'s own confident guesses on the rest', '主动学习挑出 100 张交给医生；自训练则用模型对其余的高置信度猜测'), True),
                    (T('Self-training would also ask the radiologists, but for the most confident scans', '自训练同样要问医生，只是问最有把握的那些'), T('Self-training asks nobody: the pseudo-labels come from the model.', '自训练不问任何人：伪标签来自模型自己。'), 'al-ssl-same'),
                    (T('Active learning is better because pseudo-labels are always accurate', '主动学习更好，因为伪标签总是准确的'), T('Active learning uses true labels, not pseudo-labels; and pseudo-labels are not always accurate.', '主动学习用的是真标签而不是伪标签；而伪标签并不总是准确。'), 'pseudo-true')],
                   T('Active learning spends the labelling budget; self-training spends none.', '主动学习花标注预算；自训练不花。')),
            text_q('q-motiv', T('Section A: active learning', 'A 部分：主动学习'), AL,
                   T(r"Describe the motivation behind active learning, and explain why uncertainty sampling can pick poor instances. (1-3 lines.)", r"说明主动学习背后的动机，并解释不确定性采样为什么可能选到不好的实例。（1-3 行。）"),
                   [T('Labels are scarce and expensive; the learner chooses which instances to label to reach accuracy with fewer labels', '标签稀缺且昂贵；让学习者自己选标哪些实例，以更少标签达到相同准确率'),
                    T('Uncertainty sampling queries instances near the boundary or where the model is unsure', '不确定性采样查询靠近边界或模型没把握的实例'),
                    T('It can select outliers or noise (uncertain but unrepresentative) and introduces sampling bias', '它可能选中离群点或噪声（不确定但没有代表性），并带来采样偏差')],
                   T('Labels are costly, so active learning lets the model choose which unlabelled instances an oracle should label, reaching a given accuracy with fewer labels. Uncertainty sampling queries the most uncertain instances, but these can be outliers or noise, which are uncertain yet unrepresentative, and the chosen set is biased away from the true distribution.',
                     'Labels are costly, so active learning lets the model choose which unlabelled instances an oracle should label, reaching a given accuracy with fewer labels. Uncertainty sampling queries the most uncertain instances, but these can be outliers or noise, which are uncertain yet unrepresentative, and the chosen set is biased away from the true distribution.'),
                   T('Motivation plus one weakness of uncertainty sampling.', '动机，加上不确定性采样的一个弱点。')),
            text_q('q-fail', T('Section A: self-training', 'A 部分：自训练'), ST,
                   T(r"Why can self-training make a classifier worse, and what is the usual safeguard? (1-3 lines.)", r"自训练为什么可能让分类器变差？通常的保护措施是什么？（1-3 行。）"),
                   [T('Wrong pseudo-labels are added to L and treated as truth, so errors reinforce (confirmation bias)', '错误的伪标签被加入 L 并当作真值，错误会被强化（确认偏差）'),
                    T('It needs the assumption that nearby points share labels; if it fails, labels spread wrongly', '它需要“靠近的点标签相同”的假设；假设不成立时标签会传错'),
                    T('Safeguard: a confidence threshold so only high-confidence predictions join L', '保护措施：置信度阈值，只让高置信度的预测加入 L')],
                   T('Self-training adds its own predictions to L as if they were true labels, so any wrong pseudo-label is trained on and reinforced (confirmation bias). It relies on nearby points sharing a label; where this fails the errors spread. A confidence threshold, adding only highly confident predictions, limits the damage.',
                     'Self-training adds its own predictions to L as if they were true labels, so any wrong pseudo-label is trained on and reinforced (confirmation bias). It relies on nearby points sharing a label; where this fails the errors spread. A confidence threshold, adding only highly confident predictions, limits the damage.'),
                   T('The failure (reinforced errors), its condition, and the safeguard.', '失败的原因（错误被强化）、它的条件，以及保护措施。')),
            text_q('q-design', T('Section C: labelling on a budget', 'C 部分：预算有限的标注'), AL,
                   T(r"You must build a classifier for 20,000 support emails (5 categories). You have 300 labelled emails, 19,700 unlabelled, and an annotator who can label 500 more. Propose a plan: which techniques, in which order, and what could go wrong?", r"你要为 2 万封客服邮件（5 个类别）建一个分类器。有 300 封有标签、19,700 封无标签，还有一位标注员能再标 500 封。提出方案：用哪些技术、按什么顺序、可能出什么问题？"),
                   [T('Train on the 300; use active learning (margin or entropy for 5 classes, or QBC) to choose the 500 to label, in batches', '先用 300 封训练；用主动学习（5 个类用边际或熵，或 QBC）分批挑出 500 封去标注'),
                    T('Optionally self-training with a strict threshold on the rest; hold out labelled data to validate', '可选：对其余邮件做严格阈值的自训练；留出有标签数据做验证'),
                    T('Risks: outliers/noise queried, sampling bias, confirmation bias, over-confident probabilities', '风险：查到离群点/噪声、采样偏差、确认偏差、概率过于自信'),
                    T('Mitigation: density weighting, keep a random labelled validation set, check class balance', '对策：密度加权，保留一份随机抽样的有标签验证集，检查类别平衡')],
                   T('Train a first model on the 300 labelled emails and spend the 500-label budget with active learning: score the unlabelled pool by margin (or entropy, since there are 5 classes), label the most uncertain batch, retrain, and repeat. Optionally add self-training on very confident predictions with a strict threshold. Risks are queried outliers and noise, sampling bias and confirmation bias, so use density weighting and keep a randomly sampled labelled validation set to measure real accuracy.',
                     'Train a first model on the 300 labelled emails and spend the 500-label budget with active learning: score the unlabelled pool by margin (or entropy, since there are 5 classes), label the most uncertain batch, retrain, and repeat. Optionally add self-training on very confident predictions with a strict threshold. Risks are queried outliers and noise, sampling bias and confirmation bias, so use density weighting and keep a randomly sampled labelled validation set to measure real accuracy.'),
                   T('A design answer orders the techniques and names the risks.', '设计题的答案要排好技术的顺序，并说出风险。')),
            read('remember', T('What to remember', '要记住的'),
                 table([T('Topic', '主题'), T('Remember', '记住')],
                       [T('Why', '为什么'), T('labels are scarce and costly; unlabelled data is cheap; unsupervised results are hard to interpret', '标签稀缺且昂贵；无标签数据便宜；无监督的结果难解释')],
                       [T('Semi-supervised', '半监督'), T(r"learn from $L \cup U$, $|U| \gg |L|$; needs an assumption (smoothness, cluster, manifold)", r"从 $L \cup U$ 学习，$|U| \gg |L|$；需要假设（平滑、聚类、流形）")],
                       [T('Self-training', '自训练'), T('train on L, predict U, add high-confidence pseudo-labels, repeat until L is unchanged; threshold = safety net; failure = confirmation bias', '在 L 上训练，预测 U，加入高置信度的伪标签，重复到 L 不变；阈值 = 安全网；失败方式 = 确认偏差')],
                       [T('Active learning', '主动学习'), T('the model asks an oracle for labels of chosen instances; pool-based, stream-based, query synthesis', '模型向专家要自己挑出的实例的标签；基于池、基于流、查询合成')],
                       [T('Uncertainty sampling', '不确定性采样'), T(r"least confidence: $\min \max_y P$; margin: $\min (P_1 - P_2)$; entropy: $\max -\sum P\log_2 P$. Can disagree with 3+ classes", r"最小置信度：$\min \max_y P$；边际：$\min (P_1 - P_2)$；熵：$\max -\sum P\log_2 P$。三个及以上类时可能不一致")],
                       [T('QBC', '委员会查询'), T('committee of models; query the instance with the most disagreement (vote entropy)', '一个模型委员会；查询分歧最大（投票熵最大）的实例')],
                       [T('Cautions', '注意'), T('active learning: sampling bias, outliers/noise; augmentation: label-preserving only, may add unreal features', '主动学习：采样偏差、离群点/噪声；增强：只能做不改变标签的扰动，可能引入不真实的特征')],
                       [T('Not the same', '别混淆'), T('self-training: labels from the model, free but risky; active learning: true labels from a human, costs budget', '自训练：标签来自模型，免费但有风险；主动学习：标签来自人，花预算')])),
        ])


LESSONS = [L_clustering, L_semi]
