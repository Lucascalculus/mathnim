// M4 约束：把限制写进去 / Constraints: writing the limits in. Limits become
// linear rows G U ≤ w + E x₀, so MPC solves a QP; in two dimensions the QP is a
// picture (ellipses touching a polygon), the touching limits are the active
// ones (KKT, λ as a price), clipping is not solving, and the law becomes
// piecewise affine (explicit MPC). Plan and numbers: docs/lessons/mpc/checkpoints/m4.md;
// sources: docs/lessons/mpc/research-m4.md. Visuals: mpc_qp_plane, mpc_explicit_map.
import type { Lesson } from '@mathnim/core';
import { attach, t, vis } from './common';

const QP_CODE = `import numpy as np
import cvxpy as cp

dt, N = 0.1, 20
A = np.array([[1, dt], [0, 1]]); B = np.array([[dt**2 / 2], [dt]])
Q = np.diag([1.0, 0.0]); R = 0.1; x_ref = np.array([9.5, 0.0])

# predictions X = Phi x0 + Gamma U (M2)
Phi = np.vstack([np.linalg.matrix_power(A, k) for k in range(1, N + 1)])
Gamma = np.zeros((2 * N, N))
for k in range(N):
    for j in range(k + 1):
        Gamma[2*k:2*k+2, j] = (np.linalg.matrix_power(A, k - j) @ B)[:, 0]

# the limits as rows of G U <= w + E x0
Cp = np.kron(np.eye(N), [[1, 0]]); Cv = np.kron(np.eye(N), [[0, 1]])
I = np.eye(N); one = np.ones(N)
G = np.vstack([I, -I, Cv @ Gamma, -Cv @ Gamma, Cp @ Gamma])     # (100, 20)
w = np.concatenate([one, one, 2 * one, 2 * one, 10 * one])
E = np.vstack([np.zeros((2 * N, 2)), -Cv @ Phi, Cv @ Phi, -Cp @ Phi])

# the cost (M3): 1/2 U'HU + f'U
Qb = np.kron(np.eye(N), Q)
H = 2 * (Gamma.T @ Qb @ Gamma + R * I)
f = lambda x0: 2 * Gamma.T @ Qb @ (Phi @ x0 - np.tile(x_ref, N))

def best(x0):
    U = cp.Variable(N)
    limits = [G @ U <= w + E @ x0]
    cp.Problem(cp.Minimize(0.5 * cp.quad_form(U, cp.psd_wrap(H)) + f(x0) @ U), limits).solve()
    return U.value, limits[0].dual_value          # the plan and one lambda per row

x0 = np.array([7.0, 0.0])                         # at rest, 2.5 m before the flag
U_free = -np.linalg.solve(H, f(x0))               # M3's plan, no limits
U_clip = np.clip(U_free, -1, 1)                   # what a saturating motor does
U_best, lam = best(x0)
print(U_free[[0, 9, 19]].round(2))   # [ 6.75 -0.85 -0.03]
print(U_clip[[0, 9, 19]].round(2))   # [ 1.   -0.85 -0.03]
print(U_best[[0, 9, 19]].round(2))   # [ 1.    1.    0.03]
print(np.flatnonzero(lam > 1e-6))    # [ 0 ... 14]: u_k <= 1 is active for k = 0..14
J = lambda U: 0.5 * U @ H @ U + f(x0) @ U        # the cost, up to a constant
print(round(J(U_clip) - J(U_best), 2))  # 24.63: the clipped plan costs more`;

/** The world's handle (the label qp_plane.ts gives it). */
const STATE = t("the cart's state (p₀, v₀)", '小车的状态 (p₀, v₀)');

const BEMPORAD = { type: 'cite' as const, key: 'bem', text: t('Bemporad, Morari, Dua & Pistikopoulos (2002). The explicit linear quadratic regulator for constrained systems. Automatica 38(1), 3–20.', 'Bemporad、Morari、Dua、Pistikopoulos（2002）。The explicit linear quadratic regulator for constrained systems。Automatica 38(1)，3–20。'), url: 'https://doi.org/10.1016/S0005-1098(01)00174-1' };
const SURVEY = { type: 'cite' as const, key: 'survey', text: t('Alessio & Bemporad (2009). A Survey on Explicit Model Predictive Control. In Nonlinear Model Predictive Control, LNCIS 384, 345–369.', 'Alessio、Bemporad（2009）。A Survey on Explicit Model Predictive Control。收录于 Nonlinear Model Predictive Control，LNCIS 384，345–369。'), url: 'https://doi.org/10.1007/978-3-642-01094-1_29' };

export const lesson: Lesson = {
  id: 'mpc-m4-constraints',
  title: t('Constraints: writing the limits in', '约束：把限制写进去'),
  description: t(
    'Why clipping a plan to the limits is not the same as planning with them, how limits turn MPC into a quadratic program, what the active limits and their multipliers mean, and why the constrained controller is piecewise affine.',
    '为什么把计划截断到上限，并不等于带着上限去规划；限制怎样把 MPC 变成一个二次规划；起作用的约束和它们的乘子是什么意思；以及带约束的控制器为什么是分段仿射的。'),
  mode: 'essay',
  skills: [
    { id: 'constraint-rows', name: t('Writing limits as linear rows in U', '把限制写成关于 U 的线性不等式') },
    { id: 'qp-geometry', name: t('Reading a QP as ellipses and a polygon', '把 QP 看成椭圆和多边形'), prerequisites: ['constraint-rows'] },
    { id: 'kkt-multipliers', name: t('Active limits and their multipliers', '起作用的约束与乘子'), prerequisites: ['qp-geometry'] },
    { id: 'clip-vs-solve', name: t('Why clipping is not solving', '为什么截断不等于求解'), prerequisites: ['qp-geometry'] },
    { id: 'explicit-pwa', name: t('The piecewise affine MPC law', '分段仿射的 MPC 控制律'), prerequisites: ['kkt-multipliers'] },
  ],
  misconceptions: [
    { id: 'clip-is-solve', description: t('Clipping the no-limits plan to the limits gives the best plan within the limits.', '把不管限制算出的计划截断到上限，就是守住限制的最好计划。') },
    { id: 'wall-is-local', description: t('A position limit only matters when the cart is already near it.', '位置限制只有在小车已经靠近时才起作用。') },
    { id: 'lambda-zero-matters', description: t('Relaxing any limit, active or not, makes the best plan cheaper.', '放宽任何一个限制（不管起没起作用）都能让最好的计划更便宜。') },
    { id: 'mpc-is-linear', description: t('With limits, the MPC law is still one gain matrix K, just clipped.', '有了限制，MPC 的控制律仍然是一个增益矩阵 K，只是再截断一下。') },
  ],
  steps: [
    {
      id: 'limits', kind: 'read', chapter: t('Why limits', '为什么要管限制'), title: t('A law that asks for the impossible', '一个要求做不到的事的控制律'),
      blocks: [
        { type: 'p', text: t(
          'M3 ended with a linear law: the first push is $u_0 = -K x_0$. Double the distance, double the push. A real cart has hard limits, and in this course they are: the motor gives $|a|$ up to 1 m/s², the speed must stay within 2 m/s, and the wall is at 10 m. In this lesson the flag is at 9.5 m, half a metre before the wall, with M1’s docking cost.',
          'M3 最后得到一个线性的控制律：第一下推力 $u_0 = -K x_0$。距离加倍，推力就加倍。可真实的小车有硬性的限制，本课程里是：电机最多给 1 m/s² 的加速度，速度不能超过 2 m/s，墙在 10 m 处。这一课的旗子放在 9.5 m，离墙半米，代价和 M1 停靠时一样。') },
        { type: 'p', text: t(
          'Start at rest at 7 m. M3’s law, planning 2 s ahead, asks for a first push of **6.75 m/s²**, almost seven times what the motor can give. So the motor gives what it can, 1 m/s², and the rest of the plan runs as computed. This is *clipping* (or saturation): plan as if there were no limits, then cut each input to its limit. It costs nothing and it is what happens anyway if you ignore the limits.',
          '从 7 m 处静止出发。M3 的控制律往前看 2 秒，要求第一下推 **6.75 m/s²**，差不多是电机能力的七倍。于是电机只能尽力给 1 m/s²，计划的其余部分照算好的执行。这叫*截断*（也叫饱和）：先当作没有限制来规划，再把每个输入砍到上限。它不花任何代价，而且你不管限制的话，实际发生的就是它。') },
        { type: 'p', text: t(
          'Two questions decide whether that is good enough. Is the clipped plan the best plan that keeps the limits? And what about limits on speed and position, which no motor clips for you? MPC’s answer is to write the limits into the optimisation itself: among the plans that keep **every** limit, choose the cheapest. This lesson is about what that problem looks like, what its answer looks like, and what that does to the controller.',
          '够不够用，取决于两个问题。截断后的计划，是守住限制的计划里最好的那个吗？还有速度和位置上的限制，没有哪个电机会替你"截断"它们，怎么办？MPC 的回答是：把限制直接写进优化问题里，在守住**所有**限制的计划中，选代价最小的那个。这一课讲：这个问题长什么样，它的解长什么样，以及这对控制器意味着什么。') },
      ],
    },
    {
      id: 'qp', kind: 'derive', skill: 'constraint-rows', title: t('Every limit is a row', '每个限制都是一行不等式'),
      intro: t(
        'The decision is the stacked plan $U = (u_0, \\dots, u_{N-1})$. M2 gave the predictions $X = \\Phi x_0 + \\Gamma U$; M3 gave the cost $\\tfrac12 U^\\top H U + (F x_0)^\\top U$. Now write each limit as a linear inequality in $U$.',
        '决策变量是整份计划 $U = (u_0, \\dots, u_{N-1})$。M2 给出了预测 $X = \\Phi x_0 + \\Gamma U$，M3 给出了代价 $\\tfrac12 U^\\top H U + (F x_0)^\\top U$。现在把每个限制都写成关于 $U$ 的线性不等式。'),
      lines: [
        { tex: '-u_{\\max} \\le u_k \\le u_{\\max} \\iff \\begin{bmatrix} I \\\\ -I \\end{bmatrix} U \\le \\begin{bmatrix} u_{\\max} \\mathbf 1 \\\\ u_{\\max} \\mathbf 1 \\end{bmatrix}', why: t('Motor limits act on $U$ directly: one row per input and per side.', '电机的限制直接作用在 $U$ 上：每个输入、每一侧各一行。') },
        { tex: '\\bar C_v X \\le v_{\\max} \\mathbf 1 \\;\\Rightarrow\\; \\bar C_v \\Gamma\\, U \\le v_{\\max} \\mathbf 1 - \\bar C_v \\Phi\\, x_0', why: t('A speed limit is a limit on **predictions**. $\\bar C_v$ picks every predicted speed out of $X$; substitute M2’s prediction. The left side depends on the plan, the right side on where the cart is now.', '限速是对**预测**的限制。$\\bar C_v$ 从 $X$ 里取出每一步预测的速度；把 M2 的预测代进去。左边只跟计划有关，右边只跟小车现在的状态有关。') },
        { tex: '\\tfrac12 \\Delta t^2\\, u_0 \\le p_{\\max} - p_0 - \\Delta t\\, v_0 = 10 - 9.8 - 0.1 \\times 1 = 0.1', why: t('One wall row by hand: the position after one step is $p_0 + \\Delta t\\, v_0 + \\tfrac12 \\Delta t^2 u_0$. At 9.8 m and 1 m/s the right side is 0.1, so $u_0$ may be up to 20. At 9.95 m it would be $-0.05$: the row now **demands** braking. The state moved the limit.', '手算一行"墙"的约束：一步之后的位置是 $p_0 + \\Delta t\\, v_0 + \\tfrac12 \\Delta t^2 u_0$。在 9.8 m、1 m/s 时右边是 0.1，所以 $u_0$ 最多可以到 20。如果在 9.95 m，右边就是 $-0.05$：这一行现在**要求**刹车。是状态挪动了这条限制。') },
        { tex: 'G\\,U \\le w + E\\,x_0', why: t('Stack every row. $G$ is fixed (the model and what is limited); $w$ holds the limit values; $E x_0$ shifts them with the current state. For the cart with $N = 20$: 40 motor rows, 40 speed rows, 20 wall rows, so $G$ is $100 \\times 20$.', '把所有行叠起来。$G$ 是固定的（由模型和"限制了什么"决定）；$w$ 是各个限制的数值；$E x_0$ 让它们随当前状态平移。对 $N = 20$ 的小车：电机 40 行、速度 40 行、墙 20 行，所以 $G$ 是 $100 \\times 20$。') },
        { tex: '\\min_U \\ \\tfrac12 U^\\top H U + (F x_0)^\\top U \\quad \\text{s.t.} \\quad G U \\le w + E x_0', why: t('A quadratic cost with linear inequalities: a **quadratic program** (QP) ([Bemporad et al. 2002](https://doi.org/10.1016/S0005-1098(01)00174-1)). $H \\succ 0$ because $R \\succ 0$ (M3), so the cost is a strictly convex bowl and the allowed plans form a convex polyhedron. If any plan keeps every limit, exactly one is best, and a solver cannot get stuck in a false local minimum ([Boyd & Vandenberghe](https://web.stanford.edu/~boyd/cvxbook/), §4.4).', '二次的代价加上线性不等式：这就是一个**二次规划**（QP）（[Bemporad 等 2002](https://doi.org/10.1016/S0005-1098(01)00174-1)）。因为 $R \\succ 0$（M3），所以 $H \\succ 0$，代价是一个严格凸的碗，允许的计划组成一个凸多面体。只要有计划能守住所有限制，最好的就恰好只有一个，求解器也不会卡在假的局部最小值里（[Boyd & Vandenberghe](https://web.stanford.edu/~boyd/cvxbook/)，§4.4）。') },
      ],
      blank: { line: 2, answer: '0.1', prompt: t('The cart is at $p_0 = 9.8$ m with $v_0 = 1$ m/s, $\\Delta t = 0.1$ s, wall at 10 m. What is the right-hand side of the wall row for $u_0$?', '小车在 $p_0 = 9.8$ m，$v_0 = 1$ m/s，$\\Delta t = 0.1$ s，墙在 10 m。关于 $u_0$ 的那一行"墙"约束，右边等于多少？') },
      outro: t('The solver now sees the limits. To see what it sees, we need a problem small enough to draw.', '现在求解器看得见这些限制了。要想看见它看见的东西，得找一个小到能画出来的问题。'),
    },
    {
      id: 'two-moves', kind: 'read', chapter: t('The picture', '画出来看'), title: t('A plan with two moves', '只有两步的计划'),
      blocks: [
        { type: 'p', text: t(
          'Twenty inputs make a 20-dimensional QP. To draw it, let the plan change the acceleration only once: $a_1$ held for the first second, $a_2$ for the second (*move blocking*, a standard way to shrink MPC problems[^survey]). The cost is the same docking cost over the 2 s, and the limits are checked at the end of each second. Each limit becomes a straight line in the plane of $(a_1, a_2)$:',
          '20 个输入就是一个 20 维的 QP。为了画出来，规定计划只能换一次加速度：第一秒保持 $a_1$，第二秒保持 $a_2$（这叫*分块输入*，是缩小 MPC 问题的常用办法[^survey]）。代价还是 2 秒内同样的停靠代价，限制在每一秒结束时检查。于是每个限制都变成 $(a_1, a_2)$ 平面上的一条直线：') },
        { type: 'table', head: [t('Limit', '限制'), t('As rows in $(a_1, a_2)$', '写成 $(a_1, a_2)$ 的不等式'), t('When the state changes', '状态变化时')], rows: [
          [t('motor', '电机'), t('$|a_1| \\le 1$, $|a_2| \\le 1$', '$|a_1| \\le 1$，$|a_2| \\le 1$'), t('a fixed square', '一个固定的正方形')],
          [t('speed', '速度'), t('$|v_0 + a_1| \\le 2$, $|v_0 + a_1 + a_2| \\le 2$', '$|v_0 + a_1| \\le 2$，$|v_0 + a_1 + a_2| \\le 2$'), t('the lines shift as $v_0$ grows', '$v_0$ 变大，线就平移')],
          [t('wall', '墙'), t('$p_0 + v_0 + \\tfrac12 a_1 \\le 10$, $p_0 + 2 v_0 + \\tfrac32 a_1 + \\tfrac12 a_2 \\le 10$', '$p_0 + v_0 + \\tfrac12 a_1 \\le 10$，$p_0 + 2 v_0 + \\tfrac32 a_1 + \\tfrac12 a_2 \\le 10$'), t('the lines shift as $p_0$ or $v_0$ grows', '$p_0$ 或 $v_0$ 变大，线就平移')],
        ] },
        { type: 'p', text: t(
          'So: every point of the plane is a whole plan; the plans that keep every limit form a polygon; and the cost is a bowl whose contour lines are ellipses around the no-limits plan of M3. Moving the cart shifts the lines and the centre, but never the shape of the ellipses ($H$ does not depend on the state). Watch where the best plan ends up.',
          '所以：平面上每个点都是一整份计划；守住所有限制的计划组成一个多边形；代价是一个碗，等高线是围着 M3 那个"不管限制的计划"的一圈圈椭圆。小车的状态变了，线和椭圆中心会跟着平移，但椭圆的形状不变（$H$ 跟状态无关）。看看最好的计划落在哪里。') },
        SURVEY,
      ],
    },
    {
      id: 'qp-scene', kind: 'scene', title: t('The smallest ellipse that touches', '刚好碰到的最小椭圆'), scene: vis('mpc_qp_plane'),
      narration: t(
        'Each point is a whole plan: a-one for the first second, a-two for the second. The cross is the plan without limits; each ellipse joins plans of equal cost. The motor limit cuts the plane to a square. Grow an ellipse from the cross until it touches: that point is the best plan, and the line it touches is the active limit. Add speed and wall, then move the cart. The lines slide, and the best plan slides along the edges. Fast and close to the wall, no plan is left.',
        '每个点都是一整份计划：第一秒推 a1，第二秒推 a2。叉号是不管限制时的最优计划，同一个椭圆上代价相同。电机上限把平面切成正方形。椭圆从叉号长大，第一次碰到边界的那一点就是最好的计划，碰到的那条线就是起作用的约束。再加上限速和墙，然后移动小车：约束线平移，最优点沿着边滑动。又快又近时，一个计划都不剩。'),
    },
    {
      id: 'kkt', kind: 'derive', skill: 'kkt-multipliers', title: t('Why the touching point is the best', '为什么"相切"的那一点最好'),
      intro: t(
        'The picture says: the best plan is where the smallest ellipse touches the allowed polygon. The Karush–Kuhn–Tucker (KKT) conditions say the same thing in algebra. Write the QP of the picture as $\\min_z \\tfrac12 z^\\top H z + f^\\top z$ subject to rows $g_i^\\top z \\le b_i$, with $b_i = w_i + e_i^\\top x_0$.',
        '图上说：最好的计划，在最小的那个椭圆碰到允许区域的地方。Karush–Kuhn–Tucker（KKT）条件用代数说的是同一件事。把图里的 QP 写成 $\\min_z \\tfrac12 z^\\top H z + f^\\top z$，约束是一行行 $g_i^\\top z \\le b_i$，其中 $b_i = w_i + e_i^\\top x_0$。'),
      lines: [
        { tex: 'H z^\\star + f + \\textstyle\\sum_i \\lambda_i\\, g_i = 0', why: t('At the best plan, the pull of the cost downhill, $-(H z^\\star + f)$, is balanced by the push of the limits. $g_i$ points out of the polygon, perpendicular to limit $i$’s line. With no limit touched, every $\\lambda_i = 0$ and this is M3’s $Hz + f = 0$.', '在最好的计划处，代价往"下坡"的拉力 $-(H z^\\star + f)$，被各个限制的推力抵消。$g_i$ 垂直于第 $i$ 条限制线，指向多边形外面。如果一条限制都没碰到，所有 $\\lambda_i = 0$，这就是 M3 的 $Hz + f = 0$。') },
        { tex: '\\lambda_i \\ge 0', why: t('A limit can only push back, like a wall, never pull like a magnet. That is why the gradient at the touching point is perpendicular to the edge: sliding along the edge cannot lower the cost.', '限制只能往回推，像墙一样，不能像磁铁那样往外吸。所以在相切点，梯度垂直于那条边：沿着边滑动，代价降不下去。') },
        { tex: '\\lambda_i \\,\\big(g_i^\\top z^\\star - b_i\\big) = 0', why: t('Either the limit is touched (it is *active*) or its $\\lambda_i$ is zero. A limit the best plan does not touch has no say at all ([Boyd & Vandenberghe](https://web.stanford.edu/~boyd/cvxbook/), §5.5).', '要么这条限制被碰到了（它是*起作用的*），要么它的 $\\lambda_i$ 为零。最好的计划没碰到的限制，完全没有发言权（[Boyd & Vandenberghe](https://web.stanford.edu/~boyd/cvxbook/)，§5.5）。') },
        { tex: '\\lambda_i = -\\frac{\\partial J^\\star}{\\partial b_i}', why: t('$\\lambda_i$ is the **price** of limit $i$: how much the best cost drops per unit you relax it ([Boyd & Vandenberghe](https://web.stanford.edu/~boyd/cvxbook/), §5.6). At rest at 8 m, the motor limit $a_1 \\le 1$ is active with $\\lambda = 9.06$. Raising it to 1.01 lowers $J^\\star$ by 0.0896, close to $9.06 \\times 0.01$.', '$\\lambda_i$ 是第 $i$ 个限制的**价格**：把它放宽一个单位，最好的代价能降多少（[Boyd & Vandenberghe](https://web.stanford.edu/~boyd/cvxbook/)，§5.6）。在 8 m 处静止时，电机限制 $a_1 \\le 1$ 起作用，$\\lambda = 9.06$。把它放宽到 1.01，$J^\\star$ 下降 0.0896，接近 $9.06 \\times 0.01$。') },
      ],
      outro: t('So an MPC solver returns more than a plan: it says which limits are binding and what each one costs. Next, predict what the motor limit does to the second move.', '所以 MPC 的求解器给出的不只是一份计划：它还告诉你哪些限制卡住了，每个卡了多少代价。接下来，先预测一下电机上限会对第二步做什么。'),
    },
    {
      id: 'clip-predict', kind: 'checkpoint', chapter: t('Clipping or solving', '截断还是求解'), title: t('Guess first', '先猜一猜'), skill: 'clip-vs-solve', purpose: 'predict',
      prompt: t(
        'The cart is at rest at 7 m, the flag at 9.5 m. Without limits, the two-move plan is $a_1 = 2.44$, $a_2 = -0.75$: push hard, then brake. Clipping gives $a_1 = 1$, $a_2 = -0.75$. What does the best plan that keeps $|a| \\le 1$ do in the second second?',
        '小车静止在 7 m，旗子在 9.5 m。不管限制时，两步的计划是 $a_1 = 2.44$，$a_2 = -0.75$：先猛推，再刹车。截断得到 $a_1 = 1$，$a_2 = -0.75$。守住 $|a| \\le 1$ 的最好计划，第二秒会做什么？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Brakes like the clipped plan: $a_2 \\approx -0.75$', '和截断的计划一样刹车：$a_2 \\approx -0.75$'), misconception: 'clip-is-solve' },
        { id: 'b', label: t('Pushes at the limit: $a_2 = +1$', '推满：$a_2 = +1$'), correct: true },
        { id: 'c', label: t('Coasts: $a_2 = 0$', '滑行：$a_2 = 0$') },
        { id: 'd', label: t('Brakes harder, to be safe: $a_2 = -1$', '刹得更狠，保险一点：$a_2 = -1$') },
      ] },
      explain: t(
        'It pushes: $a_2 = +1$. The brake of $-0.75$ was planned for a first push of 2.44 that the motor cannot give. With only 1 m/s² in the first second, the cart is still slow and far from the flag after 1 s, so it should keep pushing. Try it in the plane next.',
        '它继续推：$a_2 = +1$。$-0.75$ 的刹车，是给一个 2.44 的第一推准备的，而电机给不了这么多。第一秒只推了 1 m/s²，1 秒后小车还慢、还远，所以应该接着推。下面在平面上自己试试。'),
    },
    {
      id: 'qp-world', kind: 'explore', skill: 'qp-geometry', title: t('Move the cart, watch the plan', '挪动小车，看计划怎么变'),
      scene: vis('mpc_qp_plane', { story: 'setup', p0: 9, v0: 0.2 }),
      prompt: t(
        'Drag the cart’s state $(p_0, v_0)$ on the pad. ● is the best plan within the limits, □ the clipped plan. (1) Find a state at rest ($v_0$ about 0) where ● and □ disagree about the second move: one pushes, the other brakes. (2) Find a state at least 2.5 m from the wall ($p_0$ at most 7.5 m) where the **wall** is one of the active limits.',
        '在右下的面板上拖动小车的状态 $(p_0, v_0)$。● 是守住限制的最好计划，□ 是截断的计划。（1）找一个静止的状态（$v_0$ 约为 0），让 ● 和 □ 在第二步上意见相反：一个推，一个刹。（2）找一个离墙至少 2.5 m 的状态（$p_0$ 不超过 7.5 m），让**墙**成为起作用的限制之一。'),
      setup: attach('mpc_qp_plane', { story: 'setup', p0: 9, v0: 0.2 }),
      cue: [STATE],
      goals: [
        { id: 'clip', check: (s: any) => { const r = s.report(); return r.flip && r.v0 <= 0.1 && r.p0 <= 7.5; }, message: t('At rest and far away, the motor limit binds in the first second. The best plan re-plans the second second and keeps pushing; clipping keeps a brake that was meant for a push that never happened.', '静止又离得远时，第一秒卡在电机上限。最好的计划重新安排第二秒，接着推；截断的计划却保留了刹车，而那是为一次根本没发生的猛推准备的。') },
        { id: 'wall-far', check: (s: any) => { const r = s.report(); return r.wall && r.p0 <= 7.5; }, message: t('The wall is at least 2.5 m away, yet its line is active: the limit is on the **predicted** position at 2 s, not on where the cart is now.', '墙至少还有 2.5 m 远，它的线却起作用了：限制作用在 2 秒后的**预测**位置上，而不是小车现在的位置上。') },
      ],
      detectors: [
        { id: 'wall-is-local', on: (e) => (e.type === 'released' && e.data!.feasible && !e.data!.wall && (e.data!.p0 as number) >= 9.2 ? { kind: 'misconception', id: 'wall-is-local', message: t('Right by the wall but slow: the predicted positions stay before 10 m, so the wall’s line is not touched.', '紧挨着墙，但很慢：预测的位置都在 10 m 以内，所以墙那条线根本没被碰到。') } : null) },
        { id: 'no-plan', on: (e) => (e.type === 'released' && !e.data!.feasible ? { kind: 'progress', id: 'no-plan', message: t('No polygon left: from this state every plan breaks a limit. M6 is about avoiding this.', '多边形没了：从这个状态出发，每份计划都会破坏某个限制。M6 讲怎样避免这种情况。') } : null) },
      ],
      lines: [
        { text: t('Left, the plan plane: ellipses of equal cost and one line per limit. Right, the cart and its state. The dot is the best plan, the square the clipped one.', '左边是计划平面：等代价的椭圆，每个限制一条线。右边是小车和它的状态。圆点是最好的计划，方块是截断的计划。'), when: 'enter' },
        { text: t('Bring the speed down to zero and the cart far from the flag, then compare the square and the dot in the second move.', '把速度拖到零，让小车离旗子远一些，然后比较方块和圆点的第二步。'), when: 'idle' },
        { text: t('Close to the wall, but slow: the plan never reaches ten metres, so the wall stays out of the way. What counts is where the plan would take the cart.', '离墙很近，但很慢：计划根本到不了十米，所以墙不碍事。要看的是计划会把小车带到哪里。'), when: { finding: 'wall-is-local' } },
        { text: t('The shaded polygon is gone: too fast and too close, even full braking cannot keep every limit. That is infeasibility.', '阴影多边形不见了：太快、太近，就算全力刹车也守不住所有限制。这叫不可行。'), when: { finding: 'no-plan' } },
        { text: t('Clipping fixes one number. Solving re-plans all of them, and it also sees limits on the predictions.', '截断只改一个数。求解会把整份计划重新安排，还能看见作用在预测上的限制。'), when: 'goal' },
      ],
      solve: (s: any) => {
        s.set_state(7, 0);
        s.emit_released();
        s.set_state(7.1, 1.9);
        s.emit_released();
      },
    },
    {
      id: 'clip', kind: 'read', title: t('Clipping is not solving', '截断不等于求解'),
      blocks: [
        { type: 'p', text: t(
          'Clipping is exact in one case: a **single** decision with bounds. A parabola’s lowest point on an interval is its vertex, cut to the interval. With two or more moves it fails for two reasons.',
          '截断只在一种情况下是精确的：只有**一个**决策变量，并且带上下界。一条抛物线在区间上的最低点，就是把顶点截到区间里。一旦有两步或更多步，它会因为两个原因失效。') },
        { type: 'list', items: [
          t('**The moves are coupled.** $H$ is not diagonal (here $H_{12} = 4.95$): what $a_2$ should be depends on what $a_1$ actually was. The no-limits $a_2$ was designed for an $a_1$ the motor cannot deliver, so once $a_1$ is cut, $a_2$ must be re-planned. In the plane, clipping moves the point straight onto the square; the best plan slides along the edge to the smallest ellipse.', '**各步之间是耦合的。**$H$ 不是对角阵（这里 $H_{12} = 4.95$）：$a_2$ 该取多少，取决于 $a_1$ 实际是多少。不管限制时的 $a_2$，是为一个电机给不了的 $a_1$ 设计的；$a_1$ 一被砍，$a_2$ 就得重新规划。在平面上，截断是把点直直地挪到正方形上；最好的计划则沿着边滑到最小的椭圆处。'),
          t('**Clipping cannot see state limits.** It only cuts inputs. If no input is too large, it changes nothing, even when the plan drives through the wall.', '**截断看不见状态限制。**它只会砍输入。如果没有哪个输入超限，它就什么都不改，哪怕计划会撞穿墙。'),
        ] },
        { type: 'table', head: [t('Start $(p_0, v_0)$', '起点 $(p_0, v_0)$'), t('Clipped plan', '截断的计划'), t('Best plan', '最好的计划'), t('Cost: clipped / best', '代价：截断 / 最好')], rows: [
          [t('(7, 0) at rest', '(7, 0) 静止'), t('(1, −0.75): brakes', '(1, −0.75)：刹车'), t('(1, 1): pushes', '(1, 1)：推'), t('87.06 / 79.57', '87.06 / 79.57')],
          [t('(6, 1.5) fast', '(6, 1.5) 快'), t('(1, −1): 2.5 m/s after 1 s, **over the speed limit**', '(1, −1)：1 秒后 2.5 m/s，**超速**'), t('(0.5, 0)', '(0.5, 0)'), t('83.52 / 89.13', '83.52 / 89.13')],
          [t('(7.1, 1.9) fast, near', '(7.1, 1.9) 快且近'), t('(−0.27, −0.76): **past the wall** at 2 s', '(−0.27, −0.76)：2 秒时**撞穿墙**'), t('(−0.31, −0.86)', '(−0.31, −0.86)'), t('30.09 / 30.15', '30.09 / 30.15')],
        ] },
        { type: 'p', text: t(
          'Look at the last two rows: there the clipped plan is *cheaper* than the best plan. That is not a win. It is cheaper because it is illegal. A cost comparison only means something among plans that keep the limits.',
          '看最后两行：截断的计划反而比最好的计划*便宜*。这不是赢了，它便宜是因为它违规。只有在守住限制的计划之间，比较代价才有意义。') },
        { type: 'callout', kind: 'note', title: t('In the real 20-step problem', '在真实的 20 步问题里'), body: t('The same holds without move blocking. From rest at 7 m, the full QP (code below) keeps $u_k = 1$ for the first 15 steps, where clipping starts braking after 1 s; the clipped plan costs 24.63 more.', '不分块时也一样。从 7 m 静止出发，完整的 QP（代码见下）前 15 步都保持 $u_k = 1$，而截断的计划 1 秒后就开始刹车；截断的计划代价多出 24.63。') },
        { type: 'details', summary: t('Why the best plan at (7, 0) arrives fast', '为什么 (7, 0) 处最好的计划到得这么快'), blocks: [
          { type: 'p', text: t('In the two-move picture the best plan from (7, 0) reaches 2 m/s at 2 s, near the flag. The cost only prices the position, and the horizon ends there, so nothing in this plan says "and then stop". The next re-plan will brake. A short horizon that does not care what happens after its end is the subject of M6.', '在两步的图里，从 (7, 0) 出发的最好计划，2 秒时在旗子附近达到 2 m/s。代价只给位置定价，而视野到这里就结束了，所以这份计划里没有任何东西说"然后要停下"。下一次重新规划时才会刹车。视野太短、不管结束之后会发生什么，这是 M6 的主题。') },
        ] },
      ],
    },
    {
      id: 'qp-code', kind: 'code', title: t('The full QP in twenty lines', '二十行写出完整的 QP'),
      intro: t('The whole 20-step cart QP with cvxpy: the rows $G U \\le w + E x_0$, M3’s cost, and the clipped plan for comparison. The printed numbers are from running it.', '用 cvxpy 写出完整的 20 步小车 QP：不等式 $G U \\le w + E x_0$、M3 的代价，以及用来对比的截断计划。注释里的数字是实际运行的输出。'),
      lang: 'python', code: QP_CODE,
      notes: [
        { lines: [8, 13], text: t('M2’s predictions: $\\Phi$ stacks the powers of $A$, $\\Gamma$ is lower triangular.', 'M2 的预测：$\\Phi$ 叠起 $A$ 的各次幂，$\\Gamma$ 是下三角的。'), shapes: 'Phi: [40, 2]  Gamma: [40, 20]' },
        { lines: [15, 20], text: t('The limits as rows: motor $\\pm I$, speed $\\pm \\bar C_v \\Gamma$, wall $\\bar C_p \\Gamma$. $E$ carries the state into the right-hand side.', '把限制写成行：电机 $\\pm I$，速度 $\\pm \\bar C_v \\Gamma$，墙 $\\bar C_p \\Gamma$。$E$ 把状态带进右边。'), shapes: 'G: [100, 20]  w: [100]  E: [100, 2]' },
        { lines: [22, 25], text: t('M3’s condensed cost, tracking the flag at 9.5 m.', 'M3 的压缩代价，跟踪 9.5 m 处的旗子。') },
        { lines: [27, 31], text: t('The QP. The dual value of the constraint is $\\lambda$, one per row: zero for rows that are not active.', 'QP 本身。约束的对偶值就是 $\\lambda$，每行一个；不起作用的行是零。') },
        { lines: [33, 40], text: t('Free, clipped and best plans at steps 0, 9 and 19. The best plan keeps pushing at the limit for 15 steps.', '第 0、9、19 步的自由、截断和最优计划。最好的计划在上限处一直推了 15 步。') },
        { lines: [41, 42], text: t('Clipping is a legal plan here, just a worse one.', '在这里截断的计划是合法的，只是更差。') },
      ],
    },
    {
      id: 'law-predict', kind: 'checkpoint', chapter: t('The shape of the law', '控制律的形状'), title: t('Guess first', '先猜一猜'), skill: 'explicit-pwa', purpose: 'predict',
      prompt: t(
        'In M3 the first move was $a_1 = -K x_0$: a straight line in the state. Now with the limits, fix $v_0 = 1.5$ m/s and slide $p_0$ from 4 m towards the wall. What does the best first move $a_1$ look like as a function of $p_0$?',
        'M3 里第一步是 $a_1 = -K x_0$：关于状态的一条直线。现在加上限制，固定 $v_0 = 1.5$ m/s，让 $p_0$ 从 4 m 往墙那边滑。最好的第一步 $a_1$，作为 $p_0$ 的函数是什么样子？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('One straight line, clipped flat at ±1', '一条直线，在 ±1 处被削平'), misconception: 'mpc-is-linear' },
        { id: 'b', label: t('Straight pieces joined at kinks, without jumps', '一段段直线在拐点处相接，没有跳变'), correct: true },
        { id: 'c', label: t('Straight pieces with jumps between them', '一段段直线，段与段之间有跳变') },
        { id: 'd', label: t('A smooth curve', '一条光滑的曲线') },
      ] },
      explain: t(
        'Straight pieces joined at kinks. Far back, the speed limit caps $a_1$ at $2 - 1.5 = 0.5$, not the motor’s 1, so it is not a clipped line. Inside a stretch where the same limits are active, the answer is linear in the state; where another limit becomes active, the slope changes, but the plan never jumps.',
        '一段段直线，在拐点处相接。离得远时，是限速把 $a_1$ 卡在 $2 - 1.5 = 0.5$，而不是电机的 1，所以它不是一条被削平的直线。在起作用的限制保持不变的那一段里，答案是状态的线性函数；换了一个限制起作用时，斜率会变，但计划不会跳。'),
    },
    {
      id: 'explicit-scene', kind: 'scene', title: t('A map of the law', '控制律的地图'), scene: vis('mpc_explicit_map'),
      narration: t(
        'Each point of this map is a starting state. The colour says which limits the best plan presses against. Inside one colour the same limits are active, so the first move is a straight-line function of the state. Along the purple slice, the law is straight pieces that bend where the slice enters a new region, next to M3’s single dashed line.',
        '这张图上每个点都是一个初始状态，颜色表示最好的计划顶在哪些限制上。同一种颜色里，起作用的限制不变，第一步就是状态的一次函数。沿着紫色这条线看，控制律是一段段直线，每穿过一个区域边界就拐个弯；旁边的虚线是 M3 那条不管限制的直线。'),
    },
    {
      id: 'explicit', kind: 'read', title: t('Piecewise affine, and what it buys', '分段仿射，以及它带来了什么'),
      blocks: [
        { type: 'p', text: t(
          'Why straight pieces? Fix which limits are active. Then KKT is a set of **linear equations**: $Hz + f(x_0) + \\sum \\lambda_i g_i = 0$ together with $g_i^\\top z = w_i + e_i^\\top x_0$ for the active rows. Its right-hand side is affine in $x_0$, so the solution $z(x_0)$ and the multipliers are affine in $x_0$ too. That is M3’s argument again, with the active limits added as equations[^bem].',
          '为什么是一段段直线？先固定哪些限制起作用。这时 KKT 就是一组**线性方程**：$Hz + f(x_0) + \\sum \\lambda_i g_i = 0$，再加上起作用的那些行 $g_i^\\top z = w_i + e_i^\\top x_0$。方程右边是 $x_0$ 的仿射函数，所以解 $z(x_0)$ 和乘子也都是 $x_0$ 的仿射函数。这就是 M3 的推理，只是多了几条"起作用的限制"当作等式[^bem]。') },
        { type: 'math', tex: 'u_0(x_0) = K_r\\, x_0 + k_r, \\qquad x_0 \\in \\mathcal R_r' },
        { type: 'list', items: [
          t('$\\mathcal R_r$, a *critical region*: the states where the same set of limits is active. It is cut out by linear inequalities (the inactive rows still hold, every $\\lambda_i \\ge 0$), so it is a polyhedron.', '$\\mathcal R_r$ 叫*临界区域*：起作用的限制集合相同的那些状态。它由线性不等式切出来（不起作用的行仍要满足，每个 $\\lambda_i \\ge 0$），所以是一个多面体。'),
          t('$K_r, k_r$: the gain and offset on that region. In the region where nothing is active, this is exactly M3’s $-K$.', '$K_r, k_r$：这个区域上的增益和偏移。在什么限制都不起作用的区域里，它正好就是 M3 的 $-K$。'),
          t('The pieces join without jumps: the MPC law is **continuous and piecewise affine**[^bem].', '各段之间没有跳变：MPC 控制律是**连续的分段仿射函数**[^bem]。'),
        ] },
        { type: 'p', text: t(
          'So with limits MPC is no longer one matrix $K$, but it is not a mystery either. For the two-move cart there are 12 regions. This suggests *explicit MPC*: compute the regions and their gains offline, then online find the region the state is in and do one multiply-add, with no solver on board; toolboxes such as MPT3 compute the regions[^mpt]. It is used where the controller must run very fast on simple hardware[^survey].',
          '所以有了限制，MPC 不再是一个矩阵 $K$，但也不神秘。两步的小车一共 12 个区域。这就引出了*显式 MPC*：离线算好所有区域和它们的增益，在线时只要找到状态落在哪个区域，再做一次乘加，板子上不用跑求解器；MPT3 这类工具箱可以把这些区域算出来[^mpt]。需要在简单硬件上跑得非常快的场合会用它[^survey]。') },
        { type: 'callout', kind: 'warning', title: t('Only for small problems', '只适合小问题'), body: t('The number of regions can grow up to $2^q$ for $q$ constraints, and in practice it grows quickly with the number of constraints and the horizon. Explicit MPC is used for problems with about one or two inputs, up to five to ten states and three or four free moves[^survey]. Larger problems solve the QP online, which is M5.', '区域的数目最多可以到 $2^q$（$q$ 是约束的个数），实际上它也随着约束数和视野长度迅速增长。显式 MPC 用在大约一两个输入、最多五到十个状态、三四个自由步的问题上[^survey]。更大的问题就在线解 QP，这是 M5 的内容。') },
        { type: 'p', text: t(
          'The lesson in one line: writing the limits in turns MPC into a QP; its answer sits where the cost’s smallest ellipse touches the allowed polygon; the touching limits are the active ones, each with a price $\\lambda$; and because the active set changes with the state, the controller is piecewise affine.',
          '一句话总结：把限制写进去，MPC 就变成一个 QP；它的解在代价的最小椭圆碰到允许多边形的地方；碰到的那些限制就是起作用的约束，每个都有一个价格 $\\lambda$；又因为起作用的约束随状态而变，控制器是分段仿射的。') },
        BEMPORAD,
        SURVEY,
        { type: 'cite', key: 'mpt', text: t('Multi-Parametric Toolbox 3 (MPT3), a MATLAB toolbox that computes explicit MPC laws.', 'Multi-Parametric Toolbox 3（MPT3），一个能计算显式 MPC 控制律的 MATLAB 工具箱。'), url: 'https://www.mpt3.org/' },
      ],
    },
    // ------------------------------------------------------------------ checks
    {
      id: 'q-price', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('The price of a limit', '一个限制的价格'), skill: 'kkt-multipliers', purpose: 'check',
      prompt: t(
        'At some state the best plan has the motor limit $a_1 \\le 1$ active with $\\lambda = 9.06$. A stronger motor allows $a_1 \\le 1.01$. By about how much does the best cost $J^\\star$ drop?',
        '在某个状态下，最好的计划中电机限制 $a_1 \\le 1$ 起作用，$\\lambda = 9.06$。换一个更强的电机，允许 $a_1 \\le 1.01$。最好的代价 $J^\\star$ 大约下降多少？'),
      question: { type: 'number', answer: 0.0906, tolerance: 0.006, wrong: [
        { answer: 9.06, feedback: t('That is the drop per **whole unit** of relaxation. The limit moved by only 0.01.', '这是每放宽**一整个单位**的下降量。这里限制只放宽了 0.01。') },
        { answer: 0, feedback: t('$\\lambda = 9.06 > 0$: the limit is active, so relaxing it does help.', '$\\lambda = 9.06 > 0$：这个限制在起作用，放宽它确实有用。') },
      ] },
      explain: t('$\\Delta J^\\star \\approx \\lambda \\times 0.01 = 0.09$. The exact drop in the two-move QP is 0.0896: $\\lambda$ is a local slope.', '$\\Delta J^\\star \\approx \\lambda \\times 0.01 = 0.09$。在两步的 QP 里精确的下降量是 0.0896：$\\lambda$ 是局部的斜率。'),
    },
    {
      id: 'q-which', kind: 'checkpoint', title: t('Which limit to relax', '放宽哪个限制'), skill: 'kkt-multipliers', purpose: 'check',
      prompt: t(
        'At another state the solver reports $\\lambda_{\\text{wall}} = 0.8$ and $\\lambda_{\\text{speed}} = 0$, and the best plan comes within 0.01 m/s of the speed limit. You may relax one of them slightly. Which one lowers the best cost?',
        '在另一个状态下，求解器给出 $\\lambda_{\\text{墙}} = 0.8$，$\\lambda_{\\text{速度}} = 0$，而且最好的计划离限速只差 0.01 m/s。你可以稍微放宽其中一个。放宽哪个能降低最好的代价？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('The wall', '墙'), correct: true },
        { id: 'b', label: t('The speed limit: the plan is almost touching it', '限速：计划都快碰到它了'), misconception: 'lambda-zero-matters' },
        { id: 'c', label: t('Both help equally', '两个一样有用'), misconception: 'lambda-zero-matters' },
        { id: 'd', label: t('Neither: relaxing a limit never changes the plan', '都没用：放宽限制从来不会改变计划') },
      ] },
      explain: t('Only active limits have a price. A limit the best plan does not touch, however close, has $\\lambda = 0$: moving it a little changes nothing.', '只有起作用的限制才有价格。最好的计划没碰到的限制，不管离得多近，$\\lambda = 0$：稍微挪动它什么都不会变。'),
    },
    {
      id: 'q-clip', kind: 'checkpoint', title: t('When is clipping enough?', '什么时候截断就够了？'), skill: 'clip-vs-solve', purpose: 'check',
      prompt: t('When is clipping the no-limits plan guaranteed to give the best plan within the limits?', '在什么情况下，把不管限制的计划截断，一定能得到守住限制的最好计划？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('When there is a single decision variable with bounds', '只有一个决策变量，并且带上下界'), correct: true },
        { id: 'b', label: t('For any horizon, as long as only the inputs are limited', '视野多长都行，只要只限制输入'), misconception: 'clip-is-solve', feedback: t('At rest at 7 m only the motor limits bind, and the clipped plan still brakes when it should push.', '在 7 m 处静止时，起作用的只有电机限制，截断的计划还是在该推的时候刹了车。') },
        { id: 'c', label: t('Whenever the clipped plan keeps every limit', '只要截断后的计划守住了所有限制'), misconception: 'clip-is-solve', feedback: t('Legal is not the same as best: at (7, 0) the clipped plan is legal and costs 87.06 against 79.57.', '合法不等于最好：在 (7, 0)，截断的计划是合法的，但代价是 87.06，最好的是 79.57。') },
        { id: 'd', label: t('Never', '永远不会') },
      ] },
      explain: t('With one bounded variable, the minimum of a parabola on an interval is the clipped vertex. With several coupled moves, cutting one changes what the others should be, so they must be re-optimised.', '只有一个带界的变量时，抛物线在区间上的最小值就是截断后的顶点。有好几步并且互相耦合时，砍掉一步会改变其他几步该取的值，所以必须重新优化。'),
    },
    {
      id: 'q-explain', kind: 'checkpoint', title: t('Explain it', '解释一下'), skill: 'explicit-pwa', purpose: 'check',
      prompt: t(
        'A colleague says: "With limits, MPC is no longer a linear controller, so there is no formula for it and we must always run a solver online." They are half right. In two or three sentences, what does the constrained MPC law look like, and when can you avoid the online solver?',
        '同事说："有了限制，MPC 就不是线性控制器了，所以没有公式可写，必须一直在线跑求解器。"他只说对了一半。用两三句话说说：带约束的 MPC 控制律长什么样？什么时候可以不用在线求解器？'),
      question: { type: 'text', placeholder: t('The law is…, so…', '控制律是……，所以……'), rubric: {
        key_points: [
          t('In each region of states where the same limits are active, the law is affine in the state (u = K_r x + k_r).', '在起作用的限制相同的每个状态区域里，控制律是状态的仿射函数（u = K_r x + k_r）。'),
          t('The regions are polyhedra and the pieces join continuously: a continuous piecewise affine law, not a single K.', '这些区域是多面体，各段连续地接起来：是连续的分段仿射控制律，而不是一个 K。'),
          t('For small problems it can be precomputed (explicit MPC) and evaluated online by finding the region and one multiply-add; larger problems need an online QP solver because the regions multiply quickly.', '小问题可以离线算好（显式 MPC），在线时找到所在区域再做一次乘加即可；大问题的区域数增长太快，就得在线解 QP。'),
        ],
        model_answer: t(
          'It is not one linear law, but it is a formula: wherever the same limits are active, KKT is a linear system, so the first move is u = K_r x + k_r on that polyhedral region, and the pieces join continuously. For small problems the regions and gains can be computed offline (explicit MPC), so the controller only looks up the region and multiplies; for larger ones the number of regions explodes and you solve the QP online (M5).',
          '它不是一个线性律，但确实有公式：只要起作用的限制相同，KKT 就是一个线性方程组，所以在那个多面体区域上第一步是 u = K_r x + k_r，各段连续相接。小问题可以离线算好区域和增益（显式 MPC），控制器只要查区域、做乘法；大问题的区域数会爆炸，就在线解 QP（M5）。'),
        min_points: 2,
      } },
    },
  ],
};
