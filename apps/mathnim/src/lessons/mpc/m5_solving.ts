// M5 求解：每一步都要解得够快 / Solving: fast enough, every step. M4's QP has to
// be solved again every 0.1 s, in the worst case too. Condensed vs sparse (what
// a factorization costs), the three solver families on M4's plan plane
// (active set, interior point, ADMM/OSQP), being the active-set solver across
// samples (warm start), and what to do when the solver is not done in time
// (early termination, fallbacks, tolerances). Measured numbers: bench.json
// (docs/lessons/mpc/m5/bench.py, offline); sources: docs/lessons/mpc/research-m5.md.
// Visuals: mpc_solver_paths, mpc_active_set (pure TypeScript); figures in public/mpc/m5/.
import type { Lesson } from '@mathnim/core';
import { attach, t, vis } from './common';

const LOOP = `import time
import numpy as np
import cvxpy as cp

dt, N = 0.1, 20
A = np.array([[1, dt], [0, 1]]); B = np.array([[dt**2 / 2], [dt]])
x_ref = np.array([10.0, 0.0]); MARGIN = 1e-3            # 1 mm back-off from the wall (see the notes)

x0 = cp.Parameter(2)                                    # the only thing that changes per sample
X, U = cp.Variable((2, N + 1)), cp.Variable((1, N))
cost, cons = 0, [X[:, 0] == x0]
for k in range(N):
    cost += cp.square(X[0, k] - x_ref[0]) + 0.1 * cp.square(U[0, k])
    cons += [X[:, k + 1] == A @ X[:, k] + B @ U[:, k],  # sparse form: states stay variables
             cp.abs(U[0, k]) <= 1, cp.abs(X[1, k + 1]) <= 2, X[0, k + 1] <= 10 - MARGIN]
cost += cp.square(X[0, N] - x_ref[0])
prob = cp.Problem(cp.Minimize(cost), cons)              # compiled once (DPP), reused every sample

OSQP = dict(solver=cp.OSQP, warm_start=True, eps_abs=1e-4, eps_rel=1e-4,
            max_iter=4000, time_limit=0.02)             # 20 ms of the 100 ms sample
x, plan, worst, fallbacks, max_p = np.zeros(2), None, 0.0, 0, 0.0
for k in range(90):
    x0.value = x
    t0 = time.perf_counter()
    prob.solve(**OSQP)
    worst = max(worst, time.perf_counter() - t0) if k else 0.0   # sample 0 also compiles
    if prob.status in ("optimal", "optimal_inaccurate"):
        plan = U.value[0].copy()                        # keep the whole plan, not just a
        a = plan[0]
    elif plan is not None and len(plan) > 1:            # not solved in time: fall back
        plan = plan[1:]                                 # on the previous plan, shifted
        a, fallbacks = plan[0], fallbacks + 1
    else:
        a = -1.0                                        # nothing usable: brake
    a = float(np.clip(a, -1, 1))
    x = A @ x + B[:, 0] * a
    max_p = max(max_p, x[0])
print(f"end p = {x[0]:.4f} m, v = {x[1]:.4f} m/s; closest to the wall {max_p:.4f} m; "
      f"fallbacks {fallbacks}; worst solve {1e3 * worst:.0f} ms")`;

/** The chip the world's cue points at first (a limit the no-limits plan breaks at sample 18). */
const FIRST_CHIP = t('limit a1+', '限制 a1+');
const BENCH = t('Measured with docs/lessons/mpc/m5/bench.py (Apple M4, Python 3.12, OSQP 1.1.1, Clarabel 0.11.1)', '用 bench.py 实测');

export const lesson: Lesson = {
  id: 'mpc-m5-solving',
  title: t('Solving: fast enough, every step', '求解：每一步都要解得够快'),
  description: t(
    'MPC solves a new QP every sample, so the worst solve must fit the sample time. How to write the QP (condensed or sparse), how the three solver families work, why warm starting from the last plan changes everything, and what to do when the solver is not done in time.',
    'MPC 每个采样都要解一个新的 QP，所以最慢的那一次也得在采样周期里解完。QP 该怎么写（稠密还是稀疏），三类求解器各怎么工作，为什么从上一份计划热启动能省下大部分功夫，以及求解器没按时解完时该怎么办。'),
  mode: 'essay',
  skills: [
    { id: 'formulation', name: t('Condensed versus sparse QPs', '稠密形式与稀疏形式的 QP') },
    { id: 'solver-families', name: t('Active set, interior point and ADMM', '有效集法、内点法和 ADMM') },
    { id: 'active-set', name: t('Working sets and multipliers', '工作集与乘子'), prerequisites: ['solver-families'] },
    { id: 'warm-start', name: t('Warm starting across samples', '跨采样的热启动'), prerequisites: ['active-set'] },
    { id: 'real-time', name: t('Budgets, early termination and fallbacks', '时间预算、提前终止与兜底'), prerequisites: ['warm-start'] },
  ],
  misconceptions: [
    { id: 'fewer-vars-faster', description: t('Fewer unknowns always means a faster solve, so the condensed QP is always better.', '未知量越少就一定解得越快，所以稠密形式永远更好。') },
    { id: 'iterations-are-cost', description: t('The solver with fewer iterations is the faster one.', '迭代次数少的求解器就更快。') },
    { id: 'cold-every-time', description: t("Each sample's QP is a new problem and must be solved from scratch.", '每个采样的 QP 都是新问题，必须从头解。') },
    { id: 'as-hold-all', description: t('In the active-set method you should hold every limit that matters, including ones the plan already keeps.', '在有效集法里，所有"重要"的限制都该守住，包括计划本来就守得住的。') },
    { id: 'as-drop-pushing', description: t('A held limit can be let go whenever the plan sits on it.', '计划落在某条限制上时，随时都可以把它放掉。') },
    { id: 'as-three', description: t('With two decisions you can hold three limits at once.', '只有两个决策量时，也能同时守住三条限制。') },
    { id: 'average-time', description: t('If the average solve fits in the sample time, the controller is real-time.', '平均求解时间在采样周期以内，控制器就是实时的。') },
    { id: 'solved-is-exact', description: t('A QP reported as solved keeps every limit exactly.', '求解器报告"已解出"，就说明每个限制都严格守住了。') },
  ],
  steps: [
    // ------------------------------------------------------------------ the job
    {
      id: 'budget', kind: 'read', chapter: t('The job', '要做的事'), title: t('A new QP every 0.1 s', '每 0.1 秒一个新的 QP'),
      blocks: [
        { type: 'p', text: t(
          'M4 turned the cart’s MPC into a quadratic program. M1’s loop runs that QP again at **every** sample: measure the state, solve, apply the first move, and 0.1 s later do it all again from the new state. So the solver is not something you run once on a laptop and wait for. It sits inside the control loop, and it has a deadline.',
          'M4 把小车的 MPC 写成了一个二次规划（QP）。M1 的循环要在**每个**采样都把这个 QP 解一遍：测量状态，求解，执行第一步，0.1 秒后从新的状态再来一遍。所以求解器不是在笔记本上跑一次、等着出结果的东西。它就在控制回路里，而且有截止时间。') },
        { type: 'list', items: [
          t('**The worst sample counts, not the average.** If one solve in a thousand takes 150 ms, then once in a thousand samples the cart has no new input when it needs one.', '**算的是最慢的那一次，不是平均。** 一千次里只要有一次用了 150 ms，那么每一千个采样里就有一次，小车在需要新输入的时候拿不到。'),
          t('**The budget is less than the sample time.** Measuring, estimating (M7) and sending the command also take time, and on an embedded controller the processor is far slower than a laptop.', '**预算比采样周期还短。** 测量、估计（M7）和发出指令也都要时间；在嵌入式控制器上，处理器比笔记本慢得多。'),
          t('**Consecutive QPs are almost the same.** Only $x_0$ changes, and only by one sample’s worth of motion. A good solver uses that.', '**相邻两次的 QP 几乎一样。** 变的只有 $x_0$，而且只变了一个采样的运动量。好的求解器会利用这一点。'),
        ] },
        { type: 'p', text: t(
          'Four questions, in order: how to **write** the QP so that it is cheap to solve; which **algorithm** to use; how to **reuse** the last sample’s work; and what to do when the solver is **not done** in time.',
          '依次回答四个问题：QP 怎么**写**，才便宜好解；用哪种**算法**；怎样**重用**上一个采样做过的功夫；以及求解器**没按时解完**时怎么办。') },
      ],
    },
    // ------------------------------------------------------------------ formulation
    {
      id: 'size-predict', kind: 'checkpoint', chapter: t('Writing the QP', '怎么写 QP'), title: t('Guess first', '先猜一猜'), skill: 'formulation', purpose: 'predict',
      prompt: t(
        'M4’s QP has only the inputs $U$ as unknowns: $mN$ of them, and the matrix $H$ is dense. A solver factors a matrix of that size at every step. You double the horizon from $N = 80$ to $N = 160$. About how much longer does one such factorization take?',
        'M4 的 QP 只把输入 $U$ 当作未知量：一共 $mN$ 个，矩阵 $H$ 是稠密的。求解器每一步都要分解一个这么大的矩阵。把预测步数从 $N = 80$ 加倍到 $N = 160$，一次这样的分解大约要多花多少时间？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('About the same', '差不多'), feedback: t('The matrix is twice as wide and twice as tall, and every entry is nonzero.', '矩阵宽了一倍、高了一倍，而且每个元素都非零。') },
        { id: 'b', label: t('About 2×', '约 2 倍'), misconception: 'fewer-vars-faster', feedback: t('That would be true if each unknown only interacted with its neighbours. Here every input affects every later state, so everything is coupled.', '如果每个未知量只和相邻的有关，那是对的。可这里每个输入都影响之后所有的状态，所有量都耦合在一起。') },
        { id: 'c', label: t('About 4×', '约 4 倍') },
        { id: 'd', label: t('About 8×', '约 8 倍'), correct: true },
      ] },
      explain: t('Factoring a dense $n \\times n$ matrix costs about $n^3/3$ operations: twice the size, eight times the work. The measured interior-point solve on the condensed QP went from 15 ms to 229 ms, even more than 8×, because the dense limit rows grow too.', '分解一个 $n \\times n$ 的稠密矩阵大约要 $n^3/3$ 次运算：尺寸翻倍，工作量就是 8 倍。实测的稠密形式内点法求解从 15 ms 涨到了 229 ms，比 8 倍还多，因为稠密的限制行也在变多。'),
    },
    {
      id: 'formulations', kind: 'derive', skill: 'formulation', title: t('Two ways to write the same QP', '同一个 QP 的两种写法'),
      intro: t(
        'The two forms have exactly the same solution. They differ in which unknowns the solver sees, and so in the shape of the matrix it factors.',
        '这两种写法的解完全一样。不同的是求解器看到的未知量是哪些，因而它要分解的矩阵长什么样。'),
      lines: [
        { tex: '\\min_{U} \\tfrac12 U^\\top H U + (F x_0)^\\top U \\quad \\text{s.t.}\\; G U \\le w + E x_0', why: t('**Condensed.** As in M2–M4: the states are eliminated with $X = \\Phi x_0 + \\Gamma U$. Few unknowns, but $u_0$ moves every later state, so $H$ and the state rows of $G$ are full.', '**稠密形式（condensed）。** 就是 M2–M4 的写法：用 $X = \\Phi x_0 + \\Gamma U$ 把状态消掉。未知量少，但 $u_0$ 会影响之后的每个状态，所以 $H$ 和 $G$ 里状态限制那几行都是满的。') },
        { tex: '\\min_{x, u} \\sum_{k=0}^{N-1} \\big(x_k^\\top Q x_k + u_k^\\top R u_k\\big) + x_N^\\top P x_N \\quad \\text{s.t.}\\; x_{k+1} = A x_k + B u_k,\\; x_k \\in \\mathcal X,\\; u_k \\in \\mathcal U', why: t('**Sparse.** Keep the states as unknowns and give the model to the solver as equality rows. Each row involves only stage $k$ and stage $k+1$.', '**稀疏形式（sparse）。** 把状态也留作未知量，模型作为等式约束交给求解器。每一行只牵涉第 $k$ 步和第 $k+1$ 步。') },
        { tex: 'm N \\quad\\longleftrightarrow\\quad N (n + m)', why: t('The number of unknowns, condensed against sparse. For the cart ($n = 2$, $m = 1$, $N = 20$): 20 against 60, three times as many.', '未知量的个数，稠密对稀疏。对小车（$n = 2$，$m = 1$，$N = 20$）：20 个对 60 个，是它的三倍。') },
        { tex: '\\sim (mN)^3 \\quad\\longleftrightarrow\\quad \\sim N (n + m)^3', why: t('The work of one factorization. Dense: cubic in the whole size. Sparse: the matrix is banded, stage by stage, so a structured factorization costs one small cubic per stage, and $N$ stages (Wang & Boyd 2010; Kouzoupis et al. 2018, cited on the next page).', '一次分解的工作量。稠密：随总尺寸的三次方增长。稀疏：矩阵按时间步排成带状，按结构分解，每一步花一个"小立方"，一共 $N$ 步（Wang 与 Boyd 2010；Kouzoupis 等 2018，见下一页的引用）。') },
        { tex: 'N \\to 2N:\\qquad (mN)^3 \\times 8, \\qquad N (n+m)^3 \\times 2', why: t('Bigger but banded wins once the horizon is long.', '大一些但呈带状的写法，在预测步数长时胜出。') },
      ],
      blank: { line: 2, answer: 'N*(n+m)', variables: ['N', 'n', 'm'], prompt: t('How many unknowns does the sparse form have, in $N$, $n$ and $m$? (Count $u_0 \\ldots u_{N-1}$ and $x_1 \\ldots x_N$.)', '用 $N$、$n$、$m$ 写出稀疏形式的未知量个数。（数一数 $u_0 \\ldots u_{N-1}$ 和 $x_1 \\ldots x_N$。）') },
      outro: t('Next: what the two matrices look like, and what the difference costs on a real machine.', '下面看看这两个矩阵长什么样，以及在真机器上这个差别值多少。'),
    },
    {
      id: 'measured', kind: 'read', title: t('Dense and small, or sparse and big', '小而稠密，还是大而稀疏'),
      blocks: [
        { type: 'figure', src: t('mpc/m5/structure.en.svg', 'mpc/m5/structure.zh.svg'), alt: t('Two matrices at the same cell size: the condensed one is 10 by 10 and completely filled; the sparse one is 50 by 50 with nonzeros only in a band along the diagonal.', '同样格子大小的两个矩阵：稠密形式 10 × 10，全部填满；稀疏形式 50 × 50，非零元只在对角线附近的一条带上。'), credit: t('Own computation for the course cart', '按课程小车自行计算') },
        { type: 'p', text: t(
          'To see what this means in time, we solved the cart’s docking MPC (M1’s task) in a closed loop of 90 samples for horizons from 20 to 320, with an interior-point solver (Clarabel) on both forms and with OSQP (ADMM, explained below) on the sparse form:',
          '为了看清这在时间上意味着什么，我们把小车的停靠 MPC（M1 的任务）在 90 个采样的闭环里实际跑了一遍，预测步数从 20 到 320：内点法求解器（Clarabel）两种写法都跑，OSQP（ADMM，下面会讲）跑稀疏形式：') },
        { type: 'figure', src: t('mpc/m5/time-vs-n.en.svg', 'mpc/m5/time-vs-n.zh.svg'), alt: t('Log-log plot of solve time against horizon N: condensed interior point rises steeply and crosses 100 ms between N = 80 and 160; sparse interior point and ADMM grow slowly; warm-started ADMM stays below 1 ms.', '求解时间对预测步数 N 的双对数图：稠密形式的内点法陡升，在 N = 80 和 160 之间超过 100 ms；稀疏形式的内点法和 ADMM 增长缓慢；热启动的 ADMM 一直在 1 ms 以下。'), credit: BENCH },
        { type: 'list', items: [
          t('**Condensed + interior point** is already slower than the sparse form at $N = 20$ here (365 µs against 190 µs), then grows steeply: 15 ms at $N = 80$, 229 ms at $N = 160$, past the whole 100 ms sample.', '**稠密形式 + 内点法**在这里 $N = 20$ 时就已经比稀疏形式慢（365 µs 对 190 µs），之后陡增：$N = 80$ 时 15 ms，$N = 160$ 时 229 ms，超出了整个 100 ms 的采样周期。'),
          t('**Sparse + interior point** grows slowly: 0.19 ms at $N = 20$, 3.9 ms at $N = 320$. It needs 10 to 12 iterations at every horizon; the cost is in each iteration.', '**稀疏形式 + 内点法**增长缓慢：$N = 20$ 时 0.19 ms，$N = 320$ 时 3.9 ms。不管预测多少步，它都只要 10 到 12 次迭代；花时间的是每一次迭代本身。'),
          t('**Warm-started ADMM** (the dark green line) is the fastest at every $N$, and the reason is the subject of the warm-start section below.', '**热启动的 ADMM**（深绿色实线）在每个 $N$ 下都最快，原因是后面"热启动"一节的主题。'),
        ] },
        { type: 'callout', kind: 'note', title: t('Condensing is not wrong', '稠密形式并没有错'), body: t(
          'For short horizons and systems with many states but few inputs, condensing pays off: the dense QP is small, and dense active-set solvers such as qpOASES are built for it (small to medium QPs, up to about a thousand unknowns)[^qpoases][^kouzoupis]. The rule is about growth: dense cost grows like $N^3$, structured sparse cost like $N$.',
          '预测步数短、状态多而输入少的系统，用稠密形式划算：稠密的 QP 很小，qpOASES 这类稠密的有效集求解器就是为它设计的（中小规模的 QP，大约到一千个未知量）[^qpoases][^kouzoupis]。规律说的是增长：稠密的代价按 $N^3$ 增长，利用结构的稀疏代价按 $N$ 增长。') },
        { type: 'callout', kind: 'warning', title: t('These are our numbers', '这些是我们自己的数字'), body: t(
          'One laptop, Python calls included. On a microcontroller everything is slower, perhaps by a factor of 100 or more. What carries over is the slopes and the ratios, not the microseconds.',
          '一台笔记本，包括 Python 调用的开销。换到单片机上，一切都会慢得多，可能慢一百倍以上。能带走的是斜率和比例，不是这些微秒数。') },
        { type: 'cite', key: 'wangboyd', text: t('Wang & Boyd (2010). Fast model predictive control using online optimization. IEEE TCST 18(2).', 'Wang 与 Boyd（2010）。Fast model predictive control using online optimization。IEEE TCST 18(2)。'), url: 'https://doi.org/10.1109/TCST.2009.2017934' },
        { type: 'cite', key: 'kouzoupis', text: t('Kouzoupis, Frison, Zanelli & Diehl (2018). Recent advances in quadratic programming algorithms for nonlinear model predictive control. Vietnam J. Math. 46.', 'Kouzoupis、Frison、Zanelli 与 Diehl（2018）。Recent advances in quadratic programming algorithms for nonlinear model predictive control。Vietnam J. Math. 46。'), url: 'https://doi.org/10.1007/s10013-018-0311-1' },
        { type: 'cite', key: 'qpoases', text: t('Ferreau, Kirches, Potschka, Bock & Diehl (2014). qpOASES: a parametric active-set algorithm for quadratic programming. Math. Prog. Comp. 6(4).', 'Ferreau、Kirches、Potschka、Bock 与 Diehl（2014）。qpOASES: a parametric active-set algorithm for quadratic programming。Math. Prog. Comp. 6(4)。'), url: 'https://doi.org/10.1007/s12532-014-0071-1' },
      ],
    },
    // ------------------------------------------------------------------ the three families
    {
      id: 'paths', kind: 'scene', chapter: t('Three ways to the optimum', '通往最优解的三条路'), title: t('Same point, three walks', '同一个点，三种走法'),
      scene: vis('mpc_solver_paths'),
      narration: t(
        'This is M4’s plan plane, with the cart at rest at seven metres, three metres from the wall. § The best plan is the corner where both motor limits meet. § The active-set method guesses which limits hold: none, then the first motor limit, then both. Two changes, and it lands exactly on the corner. § The interior-point method starts inside the polygon and takes Newton steps along a curve that never leaves it; each step builds and factors a new matrix. § ADMM, the method inside OSQP, takes many small steps. Each one reuses the same matrix, so it is cheap, but it only gets close, to a tolerance.',
        '这是 M4 的计划平面，小车静止停在 7 米处，离墙 3 米。§最好的计划在两条电机限制相交的角上。§有效集法猜哪些限制要守住：先一个都不守，再守住第一条电机限制，然后两条都守住。改了两次，正好落在角上。§内点法从多边形内部出发，沿着一条始终不出多边形的曲线走牛顿步；每一步都要构造并分解一个新矩阵。§ADMM，也就是 OSQP 里用的方法，走很多小步。每一步都重用同一个矩阵，所以很便宜，但它只会走到足够近，也就是容差以内。'),
    },
    {
      id: 'families', kind: 'read', title: t('What each family pays for', '每一类方法花的是什么'),
      blocks: [
        { type: 'table', head: [t('Compare', '比较'), t('Active set', '有效集法'), t('Interior point', '内点法'), t('ADMM (OSQP)', 'ADMM（OSQP）')], rows: [
          [t('one step', '一步做什么'), t('add or drop one limit, solve a small equality-constrained system', '加一条或放一条限制，解一个小的等式约束方程组'), t('one Newton step on the KKT conditions: a **new** matrix to factor', '对 KKT 条件走一步牛顿法：要分解一个**新**矩阵'), t('two triangular solves with **one** matrix factored at setup, then a clip', '用 setup 时分解好的**同一个**矩阵做两次三角回代，再截断一下')],
          [t('steps', '步数'), t('one per change of the active set; can blow up in bad cases', '每改一次有效集一步；极端情况下会爆炸'), t('about 10–30, almost independent of size', '约 10–30 步，几乎与规模无关'), t('tens to thousands', '几十到几千步')],
          [t('accuracy', '精度'), t('exact', '精确'), t('high', '高'), t('modest, to a tolerance', '中等，到容差为止')],
          [t('warm start', '热启动'), t('excellent: start from last sample’s active set', '极好：从上一个采样的有效集出发'), t('hard: it wants to start inside, away from the limits', '难：它要从内部、远离限制的地方出发'), t('good: start from last sample’s plan', '好：从上一个采样的计划出发')],
          [t('typical solvers', '代表'), t('qpOASES, quadprog', 'qpOASES、quadprog'), t('Clarabel (used here)', 'Clarabel（本课实测用的）'), t('OSQP', 'OSQP')],
        ] },
        { type: 'p', text: t(
          'Why three? Because they trade the **number** of steps against the **cost** of one step. An active-set method on a small dense QP needs a handful of cheap steps when it starts from the right guess, but it can need very many when the guess is far off: in the worst case the count grows exponentially with the size[^osqp]. An interior-point method takes 10–30 steps whatever the size[^bv], but each one factors a new matrix. ADMM factors once and then iterates cheaply, so it reaches modest accuracy quickly and high accuracy slowly[^osqp].',
          '为什么有三类？因为它们在**步数**和**每一步的代价**之间做了不同的取舍。有效集法在小而稠密的 QP 上，如果起点猜得对，只要几步便宜的步；猜得差就可能要很多步：最坏情况下步数随规模指数增长[^osqp]。内点法不管规模多大都是 10–30 步[^bv]，但每一步都要分解一个新矩阵。ADMM 只分解一次，之后便宜地迭代，所以很快就能达到中等精度，要高精度就慢了[^osqp]。') },
        { type: 'callout', kind: 'misconception', title: t('Fewer iterations is not faster', '迭代少不等于快'), body: t(
          'Over the 90 samples at $N = 20$, the interior-point solver took 865 iterations and warm-started ADMM 1,405. Yet the median ADMM solve took 39 µs and the interior-point solve 190 µs. Compare time, not iteration counts.',
          '在 $N = 20$ 的 90 个采样里，内点法一共迭代了 865 次，热启动的 ADMM 迭代了 1,405 次。可 ADMM 每次求解的中位数是 39 µs，内点法是 190 µs。要比较的是时间，不是迭代次数。') },
        { type: 'p', text: t(
          'The active-set method is the easiest to see from the inside, and it is the one that shows best why the previous sample helps. You will run it by hand next.',
          '有效集法是最容易看清内部的一种，也最能说明上一个采样为什么有用。接下来你亲手跑一遍。') },
        { type: 'cite', key: 'osqp', text: t('Stellato, Banjac, Goulart, Bemporad & Boyd (2020). OSQP: an operator splitting solver for quadratic programs. Math. Prog. Comp. 12.', 'Stellato、Banjac、Goulart、Bemporad 与 Boyd（2020）。OSQP: an operator splitting solver for quadratic programs。Math. Prog. Comp. 12。'), url: 'https://arxiv.org/abs/1711.08013' },
        { type: 'cite', key: 'bv', text: t('Boyd & Vandenberghe (2004). Convex Optimization, §11.3.2.', 'Boyd 与 Vandenberghe（2004）。Convex Optimization，§11.3.2。'), url: 'https://web.stanford.edu/~boyd/cvxbook/' },
      ],
    },
    // ------------------------------------------------------------------ active set by hand
    {
      id: 'as-rules', kind: 'read', chapter: t('Be the solver', '当一回求解器'), title: t('The rules of the active-set method', '有效集法的规则'),
      blocks: [
        { type: 'p', text: t(
          'M4 showed that at the optimum some limits are **active** (the plan sits on their lines, with multiplier $\\lambda \\ge 0$) and the rest do not matter. If we knew which ones, the QP would be easy: hold those as equalities, ignore the others, and solve one linear system. The active-set method guesses that set, the **working set** $W$, and repairs the guess:',
          'M4 讲过，在最优点上有些限制**起作用**（计划正好落在它们的线上，乘子 $\\lambda \\ge 0$），其余的无关紧要。要是知道是哪几条，QP 就好解了：把它们当作等式守住，其余的不管，解一个线性方程组就行。有效集法就是去猜这个集合，即**工作集** $W$，再不断修正：') },
        { type: 'math', tex: 'z_W = \\arg\\min_z \\tfrac12 z^\\top H z + f^\\top z \\quad \\text{s.t.}\\; g_i^\\top z = b_i \\;\\; (i \\in W) \\qquad\\Longrightarrow\\qquad H z_W + f + \\textstyle\\sum_{i \\in W} \\lambda_i g_i = 0' },
        { type: 'list', ordered: true, items: [
          t('**A limit outside $W$ is broken by $z_W$:** add it to $W$.', '**$W$ 之外有一条限制被 $z_W$ 打破了：**把它加进 $W$。'),
          t('**A limit in $W$ has $\\lambda_i < 0$:** it is not pushing the plan back, it is pulling it onto its line. The plan would be cheaper off the line, on the allowed side. Let it go.', '**$W$ 里有一条限制的 $\\lambda_i < 0$：**它不是在把计划往回推，而是在把计划拉到它的线上。离开这条线、往允许的一侧走，计划会更便宜。把它放掉。'),
          t('**Nothing broken, no negative $\\lambda$:** these are exactly M4’s optimality conditions. Done.', '**没有被打破的，也没有负的 $\\lambda$：**这正是 M4 的最优条件。完成。'),
        ] },
        { type: 'p', text: t(
          'In M4’s plan plane there are two unknowns, $a_1$ and $a_2$, so at most two lines can be held at once: two lines already fix a point.',
          '在 M4 的计划平面上只有两个未知量 $a_1$ 和 $a_2$，所以最多同时守住两条线：两条线已经确定了一个点。') },
      ],
    },
    {
      id: 'as-predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'active-set', purpose: 'predict',
      prompt: t(
        'The cart moves on one sample. The solver keeps last sample’s working set $W = \\{v(1\\,\\mathrm{s}) \\le 2,\\; v(2\\,\\mathrm{s}) \\le 2\\}$. At the new state, $z_W$ breaks the wall limit $p(2\\,\\mathrm{s}) \\le 10$, and $\\lambda = -0.57$ for $v(2\\,\\mathrm{s}) \\le 2$. What should the solver do first?',
        '小车往前走了一个采样。求解器沿用上一个采样的工作集 $W = \\{v(1\\,\\mathrm{s}) \\le 2,\\; v(2\\,\\mathrm{s}) \\le 2\\}$。在新的状态下，$z_W$ 打破了墙的限制 $p(2\\,\\mathrm{s}) \\le 10$，而 $v(2\\,\\mathrm{s}) \\le 2$ 的 $\\lambda = -0.57$。求解器第一步该做什么？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Add the wall: then three limits are held', '加上墙：这样就守住了三条限制'), misconception: 'as-three' },
        { id: 'b', label: t('Let go of $v(2\\,\\mathrm{s}) \\le 2$, then look again', '放掉 $v(2\\,\\mathrm{s}) \\le 2$，再看一遍'), correct: true },
        { id: 'c', label: t('Clear $W$ and start from nothing: it is a new QP', '清空 $W$，从零开始：这是一个新的 QP'), misconception: 'cold-every-time' },
        { id: 'd', label: t('Let go of $v(1\\,\\mathrm{s}) \\le 2$', '放掉 $v(1\\,\\mathrm{s}) \\le 2$'), misconception: 'as-drop-pushing' },
      ] },
      explain: t('With two unknowns you cannot hold three lines. The limit that pulls ($\\lambda < 0$) goes first; then you look at what is broken. Try it.', '只有两个未知量，守不住三条线。先放掉在拉的那条（$\\lambda < 0$），再看哪条被打破。动手试试。'),
    },
    {
      id: 'as-world', kind: 'explore', skill: 'warm-start', title: t('Run the active-set method, sample by sample', '一个采样一个采样地跑有效集法'),
      scene: vis('mpc_active_set'),
      prompt: t(
        'Tap a limit to hold it (put it in $W$) or let it go. The ring is $z_W$, the cheapest plan on the held lines; the table shows $\\lambda$ for held limits and kept / broken for the rest. (1) At sample 18, find the optimal $W$ (the ring fills). (2) Then press **Next sample** to move the cart on, keeping $W$, and reach an optimal $W$ at **sample 23** with **at most 4 changes** after sample 18.',
        '点一条限制就守住它（放进 $W$），再点一下就放掉。圆环是 $z_W$，即落在所有守住的线上的最便宜的计划；表格里，守住的限制显示 $\\lambda$，其余的显示守住了还是被打破。（1）在第 18 个采样，找到最优的 $W$（圆环变实心）。（2）然后按**下一个采样**让小车往前走，$W$ 保持不变；要在**第 23 个采样**得到最优的 $W$，而且第 18 个采样之后**最多改动 4 次**。'),
      setup: attach('mpc_active_set'),
      cue: [FIRST_CHIP],
      actions: [
        { id: 'next', label: t('Next sample', '下一个采样'), primary: true, run: (scene: any) => scene.next_sample() },
        { id: 'restart', label: t('Back to sample 18', '回到第 18 个采样'), run: (scene: any) => scene.restart() },
      ],
      goals: [
        { id: 'cold', check: (s: any) => s.sample() === s.start && s.optimal(), message: t('Both speed limits hold: the plan reaches 2 m/s at 1 s and stays there. Nothing else is broken, and both $\\lambda$ are positive.', '两条限速都守住了：计划在 1 秒时到 2 m/s，之后保持。别的限制都没被打破，两个 $\\lambda$ 都是正的。') },
        { id: 'warm', check: (s: any) => s.sample() >= s.start + 5 && s.optimal() && s.warm.get_value() <= 4, message: t('Samples 19–21 needed no change at all, 22 one drop, 23 one add. From scratch the same five samples need 9 changes.', '第 19–21 个采样一次都不用改，第 22 个放掉一条，第 23 个加上一条。如果每次从零开始，同样这五个采样要改 9 次。') },
      ],
      detectors: [
        { id: 'hold-kept', on: (e) => (e.type === 'toggle' && e.data!.held && !e.data!.was_broken ? { kind: 'misconception', id: 'as-hold-all', message: t('$z_W$ already kept that limit. Holding it drags the plan onto its line for nothing: its $\\lambda$ comes out negative or zero.', '$z_W$ 本来就守住了这条限制。硬要守住它，只会把计划白白拖到它的线上：它的 $\\lambda$ 会是负的或零。') } : null) },
        { id: 'drop-pushing', on: (e) => (e.type === 'toggle' && !e.data!.held && (e.data!.lambda as number) > 1e-7 ? { kind: 'misconception', id: 'as-drop-pushing', message: t('That limit had $\\lambda > 0$: it was pushing the plan back. Without it the plan crosses its line again.', '这条限制的 $\\lambda > 0$：它在把计划往回推。放掉它，计划又会越过它的线。') } : null) },
        { id: 'three', on: (e) => (e.type === 'third' ? { kind: 'misconception', id: 'as-three', message: t('Two lines already fix the point: a third held line would have nowhere to go. Let one go first.', '两条线已经把点定死了：第三条守住的线没有地方可放。先放掉一条。') } : null) },
        { id: 'parallel', on: (e) => (e.type === 'parallel' ? { kind: 'progress', id: 'parallel', message: t('Those two lines are parallel: no plan lies on both.', '这两条线互相平行：没有计划能同时落在两条线上。') } : null) },
        { id: 'blocked', on: (e) => (e.type === 'next_blocked' ? { kind: 'progress', id: 'blocked', message: t('Finish this sample first: the solver only hands over a plan when $W$ is optimal.', '先把这个采样解完：只有 $W$ 是最优的，求解器才交出计划。') } : null) },
        { id: 'over-budget', on: (e) => (e.type === 'toggle' && (e.data!.warm as number) > 4 && e.data!.k !== 18 ? { kind: 'misconception', id: 'cold-every-time', message: t('More than 4 changes since sample 18. Last sample’s $W$ was nearly right: change only what the table says is wrong.', '自第 18 个采样以来已经改了 4 次以上。上一个采样的 $W$ 差不多就是对的：只改表格说有问题的那一条。') } : null) },
      ],
      lines: [
        { text: t('Left, M4’s plan plane at the cart’s current state. Right, the ten limits. Nothing is held yet, so the ring sits on the no-limits plan.', '左边是小车当前状态下 M4 的计划平面。右边是十条限制。现在什么都没守住，所以圆环就在不管限制的那份计划上。'), when: 'enter' },
        { text: t('Look for the glow: a limit the ring breaks. Hold one of those.', '找带红色光晕的线：那是圆环打破的限制。守住其中一条。'), when: 'idle' },
        { text: t('That limit was already kept. Holding it only drags the plan onto its line.', '这条限制本来就守住了。守住它只会把计划拖到它的线上。'), when: { finding: 'as-hold-all' } },
        { text: t('Its multiplier was positive: it was holding the plan back. Without it, the plan crosses the line again.', '它的乘子是正的：它在把计划往回推。放掉它，计划又会越过那条线。'), when: { finding: 'as-drop-pushing' } },
        { text: t('Two lines already fix a point. Let one go first.', '两条线已经定住了一个点。先放掉一条。'), when: { finding: 'as-three' } },
        { text: t('Last sample’s answer is almost this sample’s answer. Change only what is wrong.', '上一个采样的答案，几乎就是这一个采样的答案。只改错的那一条。'), when: { finding: 'cold-every-time' } },
        { text: t('That is warm starting: the previous answer is the best first guess, so most samples need no work at all.', '这就是热启动：上一次的答案是最好的初始猜测，所以大多数采样根本不用改。'), when: 'goal' },
      ],
      solve: (s: any) => {
        const id = (r: string) => ['a1+', 'a1-', 'a2+', 'a2-', 'v1+', 'v1-', 'v2+', 'v2-', 'p1', 'p2'].indexOf(r);
        s.toggle(id('v1+'));
        s.toggle(id('v2+'));
        for (let k = 0; k < 4; k++) s.next_sample();
        s.toggle(id('v2+'));
        s.next_sample();
        s.toggle(id('p2'));
      },
    },
    // ------------------------------------------------------------------ warm start
    {
      id: 'warm', kind: 'read', chapter: t('Reusing the last sample', '重用上一个采样'), title: t('Warm start: begin where you left off', '热启动：从上次停下的地方出发'),
      blocks: [
        { type: 'p', text: t(
          'In the world, samples 19 to 21 needed no work at all, and 22 and 23 one change each. That is not luck. MPC solves almost the same problem again: the new $x_0$ is where the last plan said the cart would be, give or take a disturbance. So the last answer is an excellent first guess. Each family reuses it in its own way:',
          '在刚才的练习里，第 19 到 21 个采样一点功夫都不用花，第 22、23 个各改一次。这不是运气。MPC 解的几乎是同一个问题：新的 $x_0$ 就是上一份计划预言的小车位置，差的只是扰动。所以上一次的答案是极好的初始猜测。每一类方法各有各的用法：') },
        { type: 'list', items: [
          t('**Active set:** start from last sample’s working set, as you just did. qpOASES follows the solution from the old $x_0$ to the new one along a straight line, changing the active set only where it must[^qpoases][^ferreau].', '**有效集法：**从上一个采样的工作集出发，就像你刚才做的那样。qpOASES 沿一条直线把解从旧的 $x_0$ 一路跟到新的 $x_0$，只在必须的地方改动有效集[^qpoases][^ferreau]。'),
          t('**ADMM:** start from last sample’s plan, **shifted** by one step (below). OSQP accepts it as a starting point[^osqp].', '**ADMM：**从上一个采样的计划出发，并**平移**一步（见下）。OSQP 可以把它当作起点[^osqp]。'),
          t('**Interior point:** hard to warm start, because it wants to start well inside, away from the limits, and the last answer sits right on them[^osqp]. Wang and Boyd still start from the shifted plan and limit the number of Newton steps[^wangboyd2].', '**内点法：**不容易热启动，因为它要从远离限制的内部出发，而上一次的答案正好贴在限制上[^osqp]。Wang 和 Boyd 仍然从平移后的计划出发，并限制牛顿步的次数[^wangboyd2]。'),
        ] },
        { type: 'math', tex: '(u^-_0,\\, u^-_1, \\ldots, u^-_{N-1}) \\quad\\longrightarrow\\quad (u^-_1,\\, u^-_2, \\ldots, u^-_{N-1},\\, u^-_{N-1})' },
        { type: 'p', text: t(
          'Here $u^-$ is last sample’s plan. The shift is M1’s receding horizon seen from the solver: last sample’s $u^-_1$ is this sample’s first guess for $u_0$, and so on. The plan is one step shorter, so the last move is repeated to fill the window. The states are shifted the same way.',
          '这里的 $u^-$ 是上一个采样的计划。这个平移就是从求解器的角度看 M1 的滚动时域：上一个采样的 $u^-_1$ 就是这一个采样对 $u_0$ 的初始猜测，依此类推。计划短了一步，所以把最后一步重复一次，把窗口填满。状态也同样平移。') },
        { type: 'figure', src: t('mpc/m5/iters.en.svg', 'mpc/m5/iters.zh.svg'), alt: t('Iterations per sample over a 90-sample run: cold-started ADMM needs 30 to 600 iterations, warm-started ADMM mostly under 20, the interior point about 10.', '90 个采样的闭环中每个采样的迭代次数：冷启动的 ADMM 要 30 到 600 次，热启动的 ADMM 大多不到 20 次，内点法约 10 次。'), credit: BENCH },
        { type: 'p', text: t(
          'Measured: warm starting cut OSQP’s total from 18,986 iterations to 1,405 over the run, and its median solve from 482 µs to 39 µs. Starting from the previous plan **without** shifting it gave 4,814, more than three times as many: the shift lines each move up with the time it is meant for.',
          '实测：热启动让 OSQP 在整个运行中的总迭代次数从 18,986 降到 1,405，每次求解的中位数从 482 µs 降到 39 µs。如果从上一份计划出发但**不平移**，总数是 4,814，是平移后的三倍多：平移让每一步对上了它本该执行的时刻。') },
        { type: 'cite', key: 'qpoases', text: t('Ferreau et al. (2014). qpOASES. Math. Prog. Comp. 6(4).', 'Ferreau 等（2014）。qpOASES。Math. Prog. Comp. 6(4)。'), url: 'https://doi.org/10.1007/s12532-014-0071-1' },
        { type: 'cite', key: 'osqp', text: t('Stellato et al. (2020). OSQP. Math. Prog. Comp. 12.', 'Stellato 等（2020）。OSQP。Math. Prog. Comp. 12。'), url: 'https://arxiv.org/abs/1711.08013' },
        { type: 'cite', key: 'ferreau', text: t('Ferreau, Bock & Diehl (2008). An online active set strategy to overcome the limitations of explicit MPC. Int. J. Robust Nonlinear Control 18(8).', 'Ferreau、Bock 与 Diehl（2008）。An online active set strategy to overcome the limitations of explicit MPC。Int. J. Robust Nonlinear Control 18(8)。'), url: 'https://doi.org/10.1002/rnc.1251' },
        { type: 'cite', key: 'wangboyd2', text: t('Wang & Boyd (2010), §III-D and §IV.', 'Wang 与 Boyd（2010），§III-D 与 §IV。'), url: 'https://doi.org/10.1109/TCST.2009.2017934' },
      ],
    },
    // ------------------------------------------------------------------ not done in time
    {
      id: 'late', kind: 'read', chapter: t('When the clock runs out', '时间到了还没解完'), title: t('Not done in time', '没按时解完'),
      blocks: [
        { type: 'p', text: t(
          'A real controller cannot wait. It gives the solver an iteration or time limit, and when the limit is hit it must apply **something**. What happens then? We limited OSQP to $k$ iterations per sample on the docking task ($N = 20$) and applied whatever it had:',
          '真实的控制器不能等。它给求解器一个迭代次数或时间的上限，到了上限就必须执行**某个**输入。那会怎样？我们在停靠任务上（$N = 20$）把 OSQP 每个采样限制在 $k$ 次迭代，到点就执行它手里的结果：') },
        { type: 'table', head: [t('Iterations allowed', '允许的迭代次数'), t('Cold start', '冷启动'), t('Warm start (shifted)', '热启动（平移）')], rows: [
          [t('5', '5'), t('never converges; drives through the wall (39.7 m)', '一次都没收敛；冲穿了墙（39.7 m）'), t('never converges; through the wall (35.0 m)', '一次都没收敛；冲穿了墙（35.0 m）')],
          [t('10', '10'), t('never converges; too timid, stops at 3.9 m', '一次都没收敛；太保守，停在 3.9 m'), t('docks; 42 of 90 samples converge', '停靠成功；90 个采样里 42 个收敛')],
          [t('20', '20'), t('never converges; reaches 2.24 m/s, over the limit', '一次都没收敛；速度到 2.24 m/s，超速'), t('docks; 63 converge', '停靠成功；63 个收敛')],
          [t('40', '40'), t('10 converge; 2.09 m/s, 9 mm past the wall', '10 个收敛；2.09 m/s，越过墙 9 mm'), t('docks; 85 converge', '停靠成功；85 个收敛')],
        ] },
        { type: 'p', text: t(
          'Warm starting is what makes a cut-off solver usable: ten iterations from the shifted plan are close to the answer, ten from scratch are nowhere near it. And the per-sample deadline is about the worst case, so measure the slowest solve, not the median.',
          '让截断的求解器还能用的，正是热启动：从平移后的计划出发迭代十次，已经接近答案；从零开始迭代十次，还差得远。另外，每个采样的截止时间针对的是最坏情况，所以要测最慢的那一次，而不是中位数。') },
        { type: 'h', text: t('Fallbacks', '兜底方案'), level: 3 },
        { type: 'list', items: [
          t('**The previous plan, shifted.** It was feasible one sample ago, and its next move is a reasonable guess. Good for an **occasional** miss. Used for many samples in a row, it is an old plan replayed open loop: in our runs with OSQP cut off at 10 iterations, falling back on it whenever a solve was not finished left the cart at 12.0 m, two metres through the wall.', '**上一份计划，平移一步。**它在一个采样之前是可行的，它的下一步是个合理的猜测。适合**偶尔**一次没解完。如果连续很多个采样都靠它，那就是在开环地重放一份旧计划：在我们的测试中，把 OSQP 截断在 10 次迭代，每次没解完都退回到它，结果小车停在 12.0 m，穿墙两米。'),
          t('**A safe default:** brake, or hold the last input, when there is no plan at all.', '**一个安全的默认动作：**一份计划都没有时，刹车，或保持上一个输入。'),
          t('**Fix the cause:** a shorter horizon, the sparse form, warm starting, a fixed iteration budget that you have measured to be enough, or no online solve at all: explicit MPC (M4) for small problems, and for nonlinear MPC, real-time iterations, one QP per sample (M8).', '**治本：**缩短预测步数，改用稀疏形式，热启动，给一个实测过够用的固定迭代预算；或者干脆不在线求解：小问题用显式 MPC（M4），非线性 MPC 用实时迭代，每个采样只解一个 QP（M8）。'),
        ] },
        { type: 'callout', kind: 'warning', title: t('"Solved" means "within tolerance"', '"解出来了"的意思是"在容差以内"'), body: t(
          'OSQP stops when its residuals are below $\\varepsilon_{\\text{abs}} + \\varepsilon_{\\text{rel}} \\cdot (\\text{size of the numbers})$, with $\\varepsilon = 10^{-3}$ by default[^settings]. Positions are about 10 m, so "solved" plans could cross the wall by 2–5 mm in our runs, and pass 2 m/s by up to 6 mm/s. Tighten the tolerance if you need to, and keep the plan a little away from limits you must never touch (a **back-off**), by more than the tolerance in that limit’s units.',
          'OSQP 在残差小于 $\\varepsilon_{\\text{abs}} + \\varepsilon_{\\text{rel}} \\cdot（数值的大小）$ 时停下，默认 $\\varepsilon = 10^{-3}$[^settings]。位置在 10 m 左右，所以在我们的运行里，"已解出"的计划可能越过墙 2–5 mm，速度也可能超出 2 m/s 多达 6 mm/s。需要的话就收紧容差，并让计划和那些绝不能碰的限制保持一点距离（**回退量**，back-off），这个距离要大于该限制单位下的容差。') },
        { type: 'cite', key: 'settings', text: t('OSQP documentation: solver settings (defaults).', 'OSQP 文档：求解器设置（默认值）。'), url: 'https://osqp.org/docs/interfaces/solver_settings.html' },
      ],
    },
    {
      id: 'loop-code', kind: 'code', title: t('A controller with a deadline', '一个有截止时间的控制器'),
      intro: t(
        'The docking MPC in the sparse form, built once, solved by OSQP every sample with a time limit, a fallback and a back-off. We ran it offline with cvxpy 1.9.3 and OSQP 1.1.3; three runs printed `end p = 9.9989–9.9994 m, closest to the wall 9.9995–9.9998 m, fallbacks 0, worst solve 26–27 ms`.',
        '稀疏形式的停靠 MPC：只构建一次，每个采样用 OSQP 求解，带时间上限、兜底和回退量。我们用 cvxpy 1.9.3 和 OSQP 1.1.3 离线跑过；三次运行输出 `end p = 9.9989–9.9994 m, closest to the wall 9.9995–9.9998 m, fallbacks 0, worst solve 26–27 ms`。'),
      lang: 'python', code: LOOP,
      notes: [
        { lines: [7, 7], text: t('The wall in the QP sits 1 mm before the real one. At OSQP’s default tolerance $10^{-3}$ this run crossed the real wall by 1.5 mm even with the back-off (3 mm without), so the code also tightens the tolerance (line 19). Back-off and tolerance work together.', 'QP 里的墙比真实的墙靠前 1 mm。在 OSQP 默认的 $10^{-3}$ 容差下，即使有这个回退，这次运行也越过了真实的墙 1.5 mm（没有回退时 3 mm），所以代码同时收紧了容差（第 19 行）。回退量和容差要一起用。') },
        { lines: [9, 9], text: t('Only $x_0$ changes from sample to sample, so it is a `Parameter`: cvxpy compiles the problem once and later solves skip that work (CVXPY docs, “Disciplined Parametrized Programming”).', '每个采样之间只有 $x_0$ 在变，所以把它设成 `Parameter`：cvxpy 只编译一次，之后的求解就省掉了这一步（见 CVXPY 文档“Disciplined Parametrized Programming”）。') },
        { lines: [10, 16], text: t('The sparse form: states are variables and the model is an equality row per step. The solver sees the banded structure.', '稀疏形式：状态也是变量，模型是每一步一行等式约束。求解器能看到带状结构。'), shapes: 'X: [2, N+1]  U: [1, N]' },
        { lines: [19, 20], text: t('`warm_start` reuses the last solution (cvxpy does not shift it; OSQP’s own interface lets you pass the shifted plan). `time_limit` caps OSQP at 20 ms; cvxpy’s own overhead comes on top, which is why the worst solve printed is 26–27 ms.', '`warm_start` 重用上一次的解（cvxpy 不会帮你平移；用 OSQP 自己的接口可以传入平移后的计划）。`time_limit` 把 OSQP 限制在 20 ms；cvxpy 自己的开销另算，所以打印出的最慢求解是 26–27 ms。') },
        { lines: [24, 26], text: t('Time every solve and keep the worst. Sample 0 also compiles the problem, so it is left out.', '每次求解都计时，记下最慢的那次。第 0 个采样还包含编译，所以不算在内。') },
        { lines: [27, 29], text: t('Keep the whole plan, not just its first move: it is the fallback for the next sample.', '把整份计划都留着，而不只是第一步：它是下一个采样的兜底。') },
        { lines: [30, 34], text: t('Not solved in time: use the previous plan, shifted. With no plan at all, brake.', '没按时解完：用上一份计划，平移一步。一份计划都没有，就刹车。') },
        { lines: [35, 36], text: t('The actuator saturates anyway, so clip, then apply one sample of the model.', '执行器反正会饱和，所以截断一下，再让模型走一个采样。') },
      ],
    },
    // ------------------------------------------------------------------ checks
    {
      id: 'q-vars', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('Count the unknowns', '数一数未知量'), skill: 'formulation', purpose: 'check',
      prompt: t('A drone’s MPC has $n = 12$ states, $m = 4$ inputs and $N = 30$. How many unknowns does the **sparse** QP have?', '一架无人机的 MPC 有 $n = 12$ 个状态、$m = 4$ 个输入，$N = 30$。**稀疏**形式的 QP 有多少个未知量？'),
      question: { type: 'number', answer: 480, tolerance: 0, wrong: [
        { answer: 120, misconception: 'fewer-vars-faster', feedback: t('That is the condensed QP: inputs only, $mN$. The sparse form keeps the states too.', '那是稠密形式：只有输入，$mN$ 个。稀疏形式把状态也留着。') },
        { answer: 360, feedback: t('That counts only the states. Add the inputs.', '这只数了状态。再加上输入。') },
      ] },
      explain: t('$N(n + m) = 30 \\times 16 = 480$, against 120 for the condensed form. Bigger, but banded: one $16 \\times 16$-sized piece of work per stage instead of one dense $120 \\times 120$ factorization.', '$N(n + m) = 30 \\times 16 = 480$，稠密形式是 120 个。更大，但呈带状：每一步做一块 $16 \\times 16$ 大小的工作，而不是分解一个 $120 \\times 120$ 的稠密矩阵。'),
    },
    {
      id: 'q-embedded', kind: 'checkpoint', title: t('A motor drive', '一个电机驱动器'), skill: 'solver-families', purpose: 'check',
      prompt: t(
        'A motor drive runs MPC at 10 kHz on a small processor: 3 states, 1 input, $N = 8$, and a current limit that is often active. The QP must be solved online. Which choice fits best?',
        '一个电机驱动器在一块小处理器上以 10 kHz 运行 MPC：3 个状态，1 个输入，$N = 8$，电流限制经常起作用。QP 必须在线求解。哪种选择最合适？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Condensed QP (8 unknowns), active-set solver warm-started from the last active set', '稠密形式（8 个未知量），有效集求解器，从上一次的有效集热启动'), correct: true },
        { id: 'b', label: t('Sparse QP, interior point solved to high accuracy from scratch each time', '稀疏形式，内点法，每次从零开始解到高精度'), misconception: 'cold-every-time', feedback: t('Interior point is hard to warm start and factors a new matrix every step; at 10 kHz on a small chip, the reuse matters more.', '内点法不容易热启动，每一步都要分解新矩阵；在小芯片上跑 10 kHz，重用上一次的结果更要紧。') },
        { id: 'c', label: t('Sparse QP with 32 unknowns, because sparse is always faster', '稀疏形式，32 个未知量，因为稀疏总是更快'), misconception: 'fewer-vars-faster', feedback: t('Sparse wins as $N$ grows. At $N = 8$ with one input, the dense QP is tiny.', '稀疏形式是在 $N$ 变大时胜出。$N = 8$、只有一个输入时，稠密的 QP 很小。') },
        { id: 'd', label: t('Any solver whose average time is below 100 µs', '任何平均时间低于 100 µs 的求解器'), misconception: 'average-time', feedback: t('The sample is 100 µs, and the worst solve has to fit, with time left for measuring and sending.', '采样周期是 100 µs，要放得下的是最慢的那次求解，还得给测量和发送留时间。') },
      ] },
      explain: t('Tiny and dense, with an active set that changes little from sample to sample: this is what online active-set solvers such as qpOASES were built for. (Explicit MPC from M4 is the other candidate here, since the problem is small.)', '小而稠密，有效集在相邻采样之间变化很少：这正是 qpOASES 这类在线有效集求解器的用武之地。（问题这么小，M4 的显式 MPC 也是一个候选。）'),
    },
    {
      id: 'q-tolerance', kind: 'checkpoint', title: t('Solved, yet past the wall', '解出来了，却越过了墙'), skill: 'real-time', purpose: 'check',
      prompt: t(
        'Every QP in your closed loop is reported "solved" by OSQP at default settings, yet the cart ends 3 mm past the wall at $p = 10$. What is the most likely explanation?',
        '在你的闭环里，OSQP 在默认设置下把每个 QP 都报告为"已解出"，可小车最后越过了 $p = 10$ 处的墙 3 mm。最可能的解释是什么？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('The QP was infeasible and OSQP did not notice', 'QP 不可行，而 OSQP 没发现') },
        { id: 'b', label: t('"Solved" is within a tolerance that scales with the numbers; at 10 m it allows millimetres. Tighten it and back the limit off a little.', '"已解出"是在一个随数值大小缩放的容差以内；在 10 m 这个量级上就是几毫米。收紧容差，再把限制往回退一点。'), correct: true },
        { id: 'c', label: t('A solved QP keeps every limit exactly, so the model must be wrong', '解出来的 QP 会严格守住每个限制，所以一定是模型错了'), misconception: 'solved-is-exact' },
        { id: 'd', label: t('Warm starting moved the plan past the wall', '热启动把计划推过了墙') },
      ] },
      explain: t('With $\\varepsilon = 10^{-3}$ absolute plus relative, a residual of a few mm on a 10 m number counts as converged. This happened in our measured runs (2–5 mm).', '在绝对加相对的 $\\varepsilon = 10^{-3}$ 下，10 m 量级上几毫米的残差就算收敛了。我们实测的运行里就出现了（2–5 mm）。'),
    },
    {
      id: 'q-late', kind: 'checkpoint', title: t('The solver is late', '求解器迟到了'), skill: 'real-time', purpose: 'check',
      prompt: t(
        'Your MPC usually solves in 2 ms of a 10 ms sample, but on rare samples OSQP hits its time limit before converging. What should the controller apply on such a sample, and what should it **not** do? Two or three sentences.',
        '你的 MPC 通常在 10 ms 的采样周期里用 2 ms 解完，但在极少数采样上，OSQP 还没收敛就碰到了时间上限。这时控制器应该执行什么，又**不**应该做什么？写两三句话。'),
      question: { type: 'text', placeholder: t('Apply…, because… Do not…', '执行……，因为……不要……'), rubric: {
        key_points: [
          t('Apply the previous plan shifted by one step (or the warm-started solver’s current iterate, clipped), since it was feasible a sample ago and is close to the answer.', '执行平移一步后的上一份计划（或热启动求解器当前的迭代结果，截断一下），因为它一个采样前是可行的，而且离答案很近。'),
          t('Do not wait past the deadline, and do not rely on the fallback for many samples in a row: that replays an old plan open loop; if misses are frequent, fix the cause (warm start, shorter horizon, measured iteration budget).', '不要超过截止时间去等，也不要连续很多个采样都靠兜底：那等于开环重放一份旧计划；如果经常解不完，就要治本（热启动、缩短预测步数、实测过的迭代预算）。'),
        ],
        model_answer: t(
          'Apply the next move of the previous plan, shifted by one step: it was feasible one sample ago and is close to what the solver would return. Do not hold up the loop waiting for convergence, and do not let the fallback run for many samples in a row, since that is an old plan replayed open loop; if it happens often, warm start, shorten the horizon or set an iteration budget you have measured to be enough.',
          '执行上一份计划平移一步后的下一步：它一个采样前是可行的，而且和求解器本来会给出的结果很接近。不要为了等收敛而拖住回路，也不要让兜底连续用很多个采样，因为那是在开环重放一份旧计划；如果经常发生，就热启动、缩短预测步数，或设一个实测够用的迭代预算。'),
        min_points: 2,
      } },
    },
    {
      id: 'choose', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('Choosing a formulation and a solver', '怎么选写法和求解器'),
      blocks: [
        { type: 'table', head: [t('Your problem', '你的问题'), t('Write it', '写法'), t('Solve it with', '求解器')], rows: [
          [t('few states and inputs, short horizon, fast sample, small chip', '状态和输入少，预测短，采样快，芯片小'), t('condensed', '稠密形式'), t('active set, warm-started from the last active set (qpOASES); or explicit MPC (M4) if it is tiny', '有效集法，从上一次的有效集热启动（qpOASES）；如果非常小，也可以用显式 MPC（M4）')],
          [t('long horizon, or many states', '预测长，或状态多'), t('sparse', '稀疏形式'), t('an interior-point solver on the sparse form (such as Clarabel) when you need accuracy; ADMM (OSQP) warm-started from the shifted plan when modest accuracy is enough', '需要精度时，在稀疏形式上用内点法（比如 Clarabel）；中等精度够用时，用从平移计划热启动的 ADMM（OSQP）')],
          [t('nonlinear model', '非线性模型'), t('sparse, linearised each sample', '稀疏形式，每个采样线性化一次'), t('one QP per sample with one of the above: real-time iterations (M8)', '每个采样用上面某种求解器解一个 QP：实时迭代（M8）')],
        ] },
        { type: 'list', items: [
          t('**Budget the worst case.** Measure the slowest solve over a long closed-loop run on the target hardware, and leave room for measuring and sending.', '**按最坏情况做预算。**在目标硬件上跑一段长的闭环，测出最慢的那次求解，再给测量和发送留出时间。'),
          t('**Always warm start**, and give the solver an iteration or time limit plus a fallback (the shifted plan) for the rare miss.', '**总是热启动**，并给求解器一个迭代次数或时间上限，再为极少数没解完的情况准备兜底（平移后的计划）。'),
          t('**Know your tolerance.** Back hard limits off by more than the solver’s tolerance in their units.', '**清楚自己的容差。**硬限制要往回退一点，退的量要大于求解器在该单位下的容差。'),
        ] },
        { type: 'callout', kind: 'misconception', title: t('Not the right reasons', '不对的理由'), body: t(
          '"Condensed has fewer unknowns, so it is faster": only for short horizons. "This solver needs fewer iterations": compare time per solve. "The average fits": the worst one has to.',
          '"稠密形式未知量少，所以更快"：只在预测步数短时成立。"这个求解器迭代次数少"：要比较每次求解的时间。"平均时间放得下"：要放得下的是最慢的那一次。') },
      ],
    },
  ],
};
