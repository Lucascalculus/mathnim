// M8 非线性 MPC 与怎么选 / Nonlinear MPC, and how to choose.
// The running example becomes a toy car on an S-shaped road (kinematic bicycle,
// packages/visuals/src/mpc/car_math.ts). Why a linear model is not enough, the
// nonlinear problem, single vs multiple shooting, Gauss–Newton SQP, the
// real-time iteration and its warm start (the world), tools and applications,
// learning + MPC, and the decision card PID / LQR / MPC / NMPC / RL.
// Sources: docs/lessons/mpc/research-m8.md (an index into research-c.md).
import type { Lesson } from '@mathnim/core';
import { CAR_LABELS } from '@mathnim/visuals/mpc';
import { attach, t, vis } from './common';

// Run offline on 2026-10-26 in docs/lessons/mpc/labs/code/.venv (CasADi 3.8.1, Python 3.12):
// prints "largest |e| = 9.3 cm, Ipopt iterations per sample: 5 to 5". Shown as text only;
// CasADi is never part of the website. Same file: docs/lessons/mpc/m8/nmpc_casadi.py.
const CASADI = `import numpy as np
import casadi as ca

# ---- the car: kinematic bicycle, x = (X, Y, psi, v), u = (a, delta)
dt, N, lf, lr = 0.1, 20, 1.4, 1.4
def f(x, u):
    beta = ca.atan(lr / (lf + lr) * ca.tan(u[1]))
    return ca.vertcat(x[3] * ca.cos(x[2] + beta), x[3] * ca.sin(x[2] + beta),
                      x[3] / lr * ca.sin(beta), u[0])
def F(x, u):                                   # one RK4 step, input held for dt
    k1 = f(x, u); k2 = f(x + dt / 2 * k1, u); k3 = f(x + dt / 2 * k2, u); k4 = f(x + dt * k3, u)
    return x + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)

# ---- the S road: straight 12, left R9 90 deg, straight 4, right R9 90 deg, straight 30
ds, pts, x, y, h = 0.05, [(0.0, 0.0, 0.0)], 0.0, 0.0, 0.0
for L, kap in [(12, 0), (9 * np.pi / 2, 1 / 9), (4, 0), (9 * np.pi / 2, -1 / 9), (30, 0)]:
    for _ in range(int(round(L / ds))):
        h += kap * ds / 2; x += ds * np.cos(h); y += ds * np.sin(h); h += kap * ds / 2
        pts.append((x, y, h))
road = np.array(pts)                           # one row every 5 cm: X, Y, heading
def road_at(s):
    return road[min(int(round(s / ds)), len(road) - 1)]

# ---- the NMPC, multiple shooting: states and inputs are both decision variables
opti = ca.Opti()
X, U = opti.variable(4, N + 1), opti.variable(2, N)
x0, ref, u_prev = opti.parameter(4), opti.parameter(4, N), opti.parameter(2)
J = 0
for k in range(N):
    e = X[:, k + 1] - ref[:, k]
    J += (3 if k == N - 1 else 1) * (e[0]**2 + e[1]**2 + e[2]**2 + 0.2 * e[3]**2)
    du = U[:, k] - (U[:, k - 1] if k else u_prev)
    J += 0.05 * U[0, k]**2 + U[1, k]**2 + 0.1 * du[0]**2 + 20 * du[1]**2
    opti.subject_to(X[:, k + 1] == F(X[:, k], U[:, k]))      # the gaps must close
opti.subject_to(X[:, 0] == x0)
opti.subject_to(opti.bounded(-4, U[0, :], 2))                # braking / accelerating
opti.subject_to(opti.bounded(-0.5, U[1, :], 0.5))            # steering, about 29 deg
opti.minimize(J)
opti.solver('ipopt', {'print_time': False}, {'print_level': 0, 'sb': 'yes'})

# ---- the closed loop: 8 s, warm-started with the last solution shifted
x, s, u, errs, iters = np.array([0.0, 0.0, 0.0, 6.0]), 0.0, np.zeros(2), [], []
Xg, Ug = np.tile(x[:, None], (1, N + 1)), np.zeros((2, N))
for step in range(80):
    R = np.array([[*road_at(s + 6 * dt * (k + 1)), 6.0] for k in range(N)]).T
    opti.set_value(x0, x); opti.set_value(ref, R)
    opti.set_value(u_prev, u)
    opti.set_initial(X, Xg); opti.set_initial(U, Ug)
    sol = opti.solve()
    Xs, Us = sol.value(X), sol.value(U)
    iters.append(sol.stats()['iter_count'])
    u = Us[:, 0]                                              # apply the first input only
    x = np.array(F(x, u)).ravel()                             # the car moves (same model)
    Xg = np.hstack([Xs[:, 1:], Xs[:, -1:]]); Ug = np.hstack([Us[:, 1:], Us[:, -1:]])
    i0 = int(s / ds); w = road[max(0, i0 - 60): i0 + 240]     # nearest road point ahead
    j = np.argmin((w[:, 0] - x[0])**2 + (w[:, 1] - x[1])**2); s = (max(0, i0 - 60) + j) * ds
    n = np.array([-np.sin(w[j, 2]), np.cos(w[j, 2])])
    errs.append(n @ (x[:2] - w[j, :2]))
print(f'largest |e| = {100 * max(map(abs, errs)):.1f} cm, '
      f'Ipopt iterations per sample: {min(iters)} to {max(iters)}')`;

const L10 = (x: { en: string; zh: string }) => t(x.en, x.zh);

export const lesson: Lesson = {
  id: 'mpc-m8-nmpc',
  title: t('Nonlinear MPC, and how to choose', '非线性 MPC 与怎么选'),
  description: t(
    'When the model is not linear: the nonlinear MPC problem, single and multiple shooting, one QP at a time (SQP), the real-time iteration and why its warm start matters, tools and real uses, learning and MPC, and a card for choosing between PID, LQR, MPC, nonlinear MPC and RL.',
    '模型不再是线性的时候怎么办：非线性 MPC 的问题、单次打靶与多重打靶、一次解一个 QP（SQP）、实时迭代以及它的热启动为什么关键、工具与真实应用、学习与 MPC，最后是一张在 PID、LQR、MPC、非线性 MPC 和强化学习之间做选择的卡片。'),
  mode: 'essay',
  skills: [
    { id: 'vehicle-model', name: t('The kinematic bicycle model and its limits', '运动学自行车模型及其适用范围') },
    { id: 'nmpc-problem', name: t('Why nonlinear MPC is not a QP', '为什么非线性 MPC 不是 QP'), prerequisites: ['vehicle-model'] },
    { id: 'shooting', name: t('Single vs multiple shooting', '单次打靶与多重打靶'), prerequisites: ['nmpc-problem'] },
    { id: 'sqp-rti', name: t('SQP and the real-time iteration', 'SQP 与实时迭代'), prerequisites: ['nmpc-problem'] },
    { id: 'choose-controller', name: t('Choosing PID, LQR, MPC, NMPC or RL', '在 PID、LQR、MPC、NMPC、RL 之间做选择') },
  ],
  misconceptions: [
    { id: 'linearise-anywhere', description: t('A model linearised once (or around any guess) predicts well everywhere; the QP’s prediction is what the car will do.', '线性化一次（或者随便围绕一个猜测线性化）的模型处处都预测得准；QP 预测的就是车会做的。') },
    { id: 'nmpc-must-converge', description: t('Nonlinear MPC must solve its problem to convergence at every sample.', '非线性 MPC 每个采样都必须把问题解到收敛。') },
    { id: 'nmpc-global', description: t('The solver finds the best plan there is (the global optimum).', '求解器找到的就是全局最优的计划。') },
    { id: 'gaps-mean-broken', description: t('Multiple shooting returns a broken trajectory, or a different answer from single shooting.', '多重打靶最后给出的是断开的轨迹，或者和单次打靶不同的答案。') },
    { id: 'kinematic-always-valid', description: t('The kinematic bicycle model is fine at any speed.', '运动学自行车模型在任何车速下都适用。') },
    { id: 'fanciest-controller', description: t('MPC (or RL) is always the better choice than PID or LQR.', 'MPC（或强化学习）总是比 PID、LQR 更好的选择。') },
  ],
  steps: [
    // ------------------------------------------------------------------ why nonlinear
    {
      id: 'why', kind: 'read', chapter: t('Why nonlinear', '为什么要非线性'), title: t('A car is not a cart', '车不是小推车'),
      blocks: [
        { type: 'p', text: t(
          'Everything so far rested on one fact from M2: with a linear model, the predictions are linear in the inputs, $X = \\Phi x_0 + \\Gamma U$, so a quadratic cost with linear limits is a QP. A car following a road breaks that fact. Steering does not add a fixed amount to the position: it turns the **direction** of travel, and where the car goes is the speed times the cosine and sine of that direction.',
          '到目前为止，一切都建立在 M2 的一个事实上：模型是线性的，预测就是输入的线性函数，$X = \\Phi x_0 + \\Gamma U$，于是二次代价加线性约束就是一个 QP。车沿着路行驶，这个事实就不成立了。打方向盘并不是给位置加上一个固定的量，它改变的是车头的**朝向**；车往哪走，是车速乘以这个朝向的余弦和正弦。') },
        { type: 'p', text: t('The usual model for path tracking at moderate speed is the **kinematic bicycle**: the two front wheels and the two rear wheels are each merged into one, and the wheels are assumed not to slide[^polack18][^kong]. State $x = (X, Y, \\psi, v)$, input $u = (a, \\delta)$:', '中等车速下做路径跟踪，最常用的是**运动学自行车模型**：把两个前轮、两个后轮各合成一个轮子，并假设轮子不打滑[^polack18][^kong]。状态 $x = (X, Y, \\psi, v)$，输入 $u = (a, \\delta)$：') },
        { type: 'math', tex: '\\dot X = v\\cos(\\psi + \\beta),\\quad \\dot Y = v\\sin(\\psi + \\beta),\\quad \\dot\\psi = \\frac{v}{l_r}\\sin\\beta,\\quad \\dot v = a,\\qquad \\beta = \\arctan\\Big(\\frac{l_r}{l_f + l_r}\\tan\\delta\\Big)' },
        { type: 'list', items: [
          t('$X, Y$: where the centre of gravity is. $\\psi$: where the car points. $v$: its speed.', '$X, Y$：重心的位置。$\\psi$：车头朝向。$v$：车速。'),
          t('$\\delta$: the front steering angle. $\\beta$: the angle between where the car points and where its centre of gravity actually moves (the slip angle at the centre of gravity). It comes from geometry alone; $l_f, l_r$ are the distances from the centre of gravity to the front and rear axles.', '$\\delta$：前轮转角。$\\beta$：车头指向和重心实际运动方向之间的夹角（重心处的侧偏角）。它纯粹由几何决定；$l_f, l_r$ 是重心到前、后轴的距离。'),
          t('$\\dot\\psi = (v/l_r)\\sin\\beta$: the same steering turns the car faster when it drives faster. With the steering held, the centre of gravity drives a circle of radius $l_r/\\sin\\beta$.', '$\\dot\\psi = (v/l_r)\\sin\\beta$：同样的方向盘角度，车开得越快，转向越快。方向盘保持不动时，重心走的是一个半径为 $l_r/\\sin\\beta$ 的圆。'),
          t('The nonlinearity sits in $\\cos$, $\\sin$, $\\arctan\\tan$ and the product of $v$ with them.', '非线性就在 $\\cos$、$\\sin$、$\\arctan\\tan$，以及 $v$ 和它们的乘积里。'),
        ] },
        { type: 'p', text: t(
          '**Why not linearise once, as in M2?** Take our toy car (axles 1.4 m from the centre of gravity) at 6 m/s, linearise it about driving straight, and hold the steering at 0.2 rad for 2 s. The linear model still puts the car 12 m ahead, as if it had not turned; the real model has it curve away on a 13.9 m circle and end up 2.0 m from that prediction. At 0.4 rad the two disagree by 7.9 m (simulation, tested). A linearisation is only good near the motion it was taken around, and a car on a winding road keeps leaving that motion.',
          '**为什么不像 M2 那样线性化一次就好？**拿我们的玩具车（前后轴到重心都是 1.4 m），以 6 m/s 的速度，围绕"直行"线性化，然后把方向盘保持在 0.2 rad 两秒钟。线性模型仍然认为车正前方走了 12 m，好像根本没转弯；真实模型里车沿一个 13.9 m 的圆弯了出去，最后离线性模型的预测 2.0 m。打到 0.4 rad，两者相差 7.9 m（模拟结果，有单元测试）。线性化只在它所围绕的那条运动附近才准，而车在弯道上会不断离开那条运动。') },
        { type: 'callout', kind: 'warning', title: t('What the model leaves out', '这个模型没有考虑什么'), body: t(
          'Tyres that slip and skid. The kinematic model stays consistent with a much richer 9-degree-of-freedom model as long as the lateral acceleration stays below about $0.5\\,\\mu g$ ($\\mu$: road friction)[^polack17]. Our S road has bends of radius 9 m driven at 6 m/s: $v^2/R = 4$ m/s², about 0.41 g, inside that bound on a dry road. Faster, or on ice, you need a dynamic model with tyre forces (Falcone et al. did exactly that, below).',
          '轮胎的打滑和侧滑。只要侧向加速度低于约 $0.5\\,\\mu g$（$\\mu$ 是路面摩擦系数），运动学模型就和一个复杂得多的 9 自由度模型保持一致[^polack17]。我们的 S 形路弯道半径 9 m、车速 6 m/s：$v^2/R = 4$ m/s²，约 0.41 g，在干燥路面上处于这个范围之内。更快，或者在冰面上，就需要带轮胎力的动力学模型（下面 Falcone 等人做的正是这个）。') },
        { type: 'p', text: t('The course’s car for this lesson: a toy (not a real vehicle), $|\\delta|$ up to 0.5 rad, $a$ between −4 and 2 m/s², sample time 0.1 s, horizon $N = 20$ (2 s), following the S road at 6 m/s.', '本节课的车是一辆玩具车（不是真实车辆）：$|\\delta|$ 不超过 0.5 rad，$a$ 在 −4 到 2 m/s² 之间，采样时间 0.1 s，预测时域 $N = 20$（2 秒），以 6 m/s 沿 S 形路行驶。') },
        { type: 'cite', key: 'polack18', text: t('Polack, Altché, d’Andréa-Novel & de La Fortelle (2018). Guaranteeing Consistency in a Motion Planning and Control Architecture Using a Kinematic Bicycle Model. ACC (equations after Rajamani 2012).', 'Polack、Altché、d’Andréa-Novel、de La Fortelle（2018）。Guaranteeing Consistency in a Motion Planning and Control Architecture Using a Kinematic Bicycle Model。ACC（方程引自 Rajamani 2012）。'), url: 'https://arxiv.org/abs/1804.08290' },
        { type: 'cite', key: 'kong', text: t('Kong, Pfeiffer, Schildbach & Borrelli (2015). Kinematic and dynamic vehicle models for autonomous driving control design. IEEE IV.', 'Kong、Pfeiffer、Schildbach、Borrelli（2015）。Kinematic and dynamic vehicle models for autonomous driving control design。IEEE IV。'), url: 'https://doi.org/10.1109/IVS.2015.7225830' },
        { type: 'cite', key: 'polack17', text: t('Polack et al. (2017). The kinematic bicycle model: a consistent model for planning feasible trajectories for autonomous vehicles? IEEE IV.', 'Polack 等（2017）。The kinematic bicycle model: a consistent model for planning feasible trajectories for autonomous vehicles? IEEE IV。'), url: 'https://doi.org/10.1109/IVS.2017.7995816' },
      ],
    },
    {
      id: 'problem', kind: 'derive', title: t('The problem is no longer a QP', '问题不再是 QP'), skill: 'nmpc-problem',
      intro: t('Write the same MPC as before, with the car’s step $x_{k+1} = F(x_k, u_k)$ (one Runge–Kutta step of the equations above) in place of $Ax_k + Bu_k$.', '还是原来的 MPC，只是把 $Ax_k + Bu_k$ 换成车的一步 $x_{k+1} = F(x_k, u_k)$（对上面的方程做一步龙格–库塔积分）。'),
      lines: [
        { tex: '\\min_{U}\\; \\sum_{k=1}^{N} \\lVert x_k - r_k \\rVert_Q^2 + \\sum_{k=0}^{N-1} \\lVert u_k \\rVert_R^2 \\quad \\mathrm{s.t.}\\quad x_{k+1} = F(x_k, u_k),\\;\\; u_{\\min} \\le u_k \\le u_{\\max}', why: t('The reference $r_k$ is a point on the road every 0.6 m ahead (6 m/s × 0.1 s). The cost and the limits are as in M3–M4; in the lesson’s car the cost also penalises changes of the inputs, for smooth steering.', '参考 $r_k$ 是路上往前每隔 0.6 m（6 m/s × 0.1 s）取的一个点。代价和约束和 M3–M4 一样；本课的车在代价里还惩罚输入的变化，让方向盘打得平顺。') },
        { tex: 'A, B \\;\\Rightarrow\\; X = \\Phi x_0 + \\Gamma U \\;\\Rightarrow\\; J(U) = \\tfrac12 U^\\top H U + f^\\top U + c', why: t('Linear model (M2–M4): the states are linear in $U$, so the cost is a quadratic bowl: one minimum, found exactly by a QP solver.', '线性模型（M2–M4）：状态是 $U$ 的线性函数，代价是一个二次的"碗"：只有一个最低点，QP 求解器能精确找到。') },
        { tex: 'F \\;\\Rightarrow\\; X(U) = \\big(F(x_0, u_0),\\; F(F(x_0, u_0), u_1),\\; \\dots\\big)', why: t('Nonlinear model: the states are nested compositions of $F$; they bend with $U$.', '非线性模型：状态是 $F$ 层层嵌套的结果，随 $U$ 弯曲变化。') },
        { tex: 'J(U) = \\sum_k \\lVert x_k(U) - r_k \\rVert_Q^2 + \\dots', why: t('The cost is no longer a bowl. It can have several valleys, so a solver like Ipopt (interior point) finds a **local** solution near where it starts (see the tools page). The starting guess matters, which is the theme of the rest of the lesson.', '代价不再是一个碗。它可能有好几个"山谷"，所以像 Ipopt（内点法）这样的求解器找到的是起点附近的一个**局部**解（见后面的工具一节）。初始猜测因此很重要，这就是本课余下部分的主线。') },
      ],
      outro: t('This is a nonlinear program (NLP). Two questions follow: which unknowns to give the solver (shooting, next), and how to solve it fast enough every 0.1 s (SQP and RTI, after that).', '这是一个非线性规划（NLP）。接下来有两个问题：把哪些量交给求解器当未知量（打靶法，下一节），以及怎样在每 0.1 秒内解得足够快（再下一节的 SQP 和 RTI）。'),
    },
    {
      id: 'local-q', kind: 'checkpoint', title: t('Two answers?', '两个答案？'), skill: 'nmpc-problem', purpose: 'practice',
      prompt: t('You solve the same car problem twice with Ipopt, from two different starting guesses. Both runs report success, but the plans differ. What is going on?', '你用 Ipopt 把同一个车的问题解了两次，初始猜测不同。两次都报告成功，但计划不一样。这是怎么回事？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('A bug: an optimiser returns the one best plan', '有 bug：优化器应该返回唯一的最佳计划'), misconception: 'nmpc-global' },
        { id: 'b', label: t('Expected: the cost is not a bowl, and each run found a local minimum near its start', '正常：代价不是一个碗，每次都找到了起点附近的一个局部最小'), correct: true },
        { id: 'c', label: t('The limits were violated in one run', '其中一次违反了约束') },
      ] },
      explain: t('With a nonlinear model the problem is nonconvex, and Ipopt finds a local solution. That is why NMPC cares so much about where it starts.', '模型非线性时问题是非凸的，Ipopt 找到的是局部解。这正是 NMPC 如此在意从哪里出发的原因。'),
    },
    // ------------------------------------------------------------------ shooting
    {
      id: 'shooting-scene', kind: 'scene', chapter: t('Shooting', '打靶法'), title: t('Two ways to give the solver the trajectory', '把轨迹交给求解器的两种方式'),
      scene: vis('mpc_shooting', { iters: 3 }),
      narration: t(
        'One horizon of the car entering the first bend, solved from scratch in two ways. § On the left, single shooting: the only unknowns are the twenty-five inputs, and the path comes from simulating them, so it is always one unbroken line. It starts as straight ahead and bends towards the green reference points, iteration by iteration. § On the right, multiple shooting: the start of every piece is an unknown too. Each piece is simulated on its own, and at first they do not join: the coral gaps are the dynamics not yet satisfied. § One iteration nearly closes them. § Watch the end: both methods arrive at the same plan.',
        '这是车进入第一个弯时的一个预测时域，用两种方法从头求解。§左边是单次打靶：未知量只有 25 个输入，轨迹靠把它们一路仿真出来，所以永远是一条连续的线。它从"直行"出发，一次迭代一次迭代地弯向绿色的参考点。§右边是多重打靶：每一段的起点也是未知量。每一段单独仿真，一开始段与段之间接不上：珊瑚色的缺口就是还没满足的动力学约束。§一次迭代几乎就把缺口合上了。§看最后：两种方法得到的是同一个计划。'),
    },
    {
      id: 'shooting-read', kind: 'read', title: t('Single or multiple shooting?', '单次打靶还是多重打靶？'),
      blocks: [
        { type: 'table', head: [t('aspect', '方面'), t('single shooting', '单次打靶'), t('multiple shooting', '多重打靶')], rows: [
          [t('unknowns', '未知量'), t('the inputs $u_0..u_{N-1}$', '输入 $u_0..u_{N-1}$'), t('the inputs and the start state $s_k$ of every interval', '输入，加上每个区间的起点状态 $s_k$')],
          [t('dynamics', '动力学'), t('built in: states are simulated', '内置：状态靠仿真得到'), t('constraints $s_{k+1} = F(s_k, u_k)$, met at convergence', '约束 $s_{k+1} = F(s_k, u_k)$，收敛时才满足')],
          [t('every iterate', '每次迭代的结果'), t('a real trajectory of the car', '一条车真能走出来的轨迹'), t('may have gaps', '可能有缺口')],
          [t('problem size', '问题规模'), t('small, dense', '小而稠密'), t('larger, but sparse (stage by stage, as in M5)', '更大，但稀疏（逐级排列，就像 M5 讲的）')],
        ] },
        { type: 'p', text: t('Why carry extra unknowns? The textbook gives three reasons for multiple shooting[^rmd]: the intervals can be integrated in parallel; the start states can be **initialised from data** (a recorded drive, the last plan), not only from a guess of the inputs; and Newton-type iterations often contract faster, "in particular for nonlinear and unstable systems", because an error in an early input no longer has to be propagated through the whole horizon. In the scene, after one iteration the multiple-shooting inputs already cost 1.54, against 8.39 for single shooting (simulation of our toy car; both end at 1.52). Its price: the solver must also watch the gaps, and an unfinished iterate is not a trajectory the car can drive.', '为什么要多带这些未知量？教科书给出了多重打靶的三个理由[^rmd]：各个区间可以并行积分；起点状态可以**从数据初始化**（一次记录下来的驾驶、上一个计划），而不只能从输入的猜测推出来；牛顿类迭代往往收敛得更快，"特别是对非线性和不稳定的系统"，因为前面某个输入的误差不必再传遍整个时域。在刚才的动画里，迭代一次之后，多重打靶得到的输入代价已经是 1.54，单次打靶还是 8.39（玩具车的模拟；两者最后都是 1.52）。代价是：求解器还得盯着缺口，而没算完的中间结果不是车能开出来的轨迹。') },
        { type: 'callout', kind: 'misconception', body: t('"Multiple shooting returns a broken path." Only while iterating: the gaps are constraints, and the answer satisfies them. At convergence both methods solve the same problem and give the same plan (in the scene, equal to $10^{-5}$).', '"多重打靶给出的是断开的路径。"只在迭代过程中才是这样：缺口是约束，最后的答案满足它们。收敛时两种方法解的是同一个问题，给出同一个计划（动画里两者相差不到 $10^{-5}$）。') },
        { type: 'p', text: t('Most NMPC software uses multiple shooting or the related collocation; so does the CasADi code later in this lesson. The rest of the lesson uses single shooting for the derivation, because it is the shortest step from M2.', '大多数 NMPC 软件用的是多重打靶，或者与之相近的配点法；本课后面的 CasADi 代码也用多重打靶。下面的推导用单次打靶，因为它离 M2 最近。') },
        { type: 'cite', key: 'rmd', text: t('Rawlings, Mayne & Diehl (2017/2020). Model Predictive Control: Theory, Computation, and Design, 2nd ed., §8.5.1–8.5.2 (after Bock & Plitt 1984). Free PDF.', 'Rawlings、Mayne、Diehl（2017/2020）。Model Predictive Control: Theory, Computation, and Design，第 2 版，§8.5.1–8.5.2（源自 Bock 与 Plitt 1984）。免费 PDF。'), url: 'https://sites.engineering.ucsb.edu/~jbraw/mpc/' },
      ],
    },
    {
      id: 'shooting-q', kind: 'checkpoint', title: t('After convergence', '收敛以后'), skill: 'shooting', purpose: 'practice',
      prompt: t('Both methods have converged on the same horizon. How does the multiple-shooting plan compare with the single-shooting one?', '两种方法在同一个时域上都收敛了。多重打靶的计划和单次打靶的相比怎样？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('The same plan, and an unbroken trajectory', '是同一个计划，而且是连续的轨迹'), correct: true },
        { id: 'b', label: t('Still a few small gaps, so it cannot be driven exactly', '还剩几个小缺口，所以车没法精确地走出来'), misconception: 'gaps-mean-broken' },
        { id: 'c', label: t('A better plan, because it has more unknowns', '更好的计划，因为它的未知量更多'), misconception: 'gaps-mean-broken' },
      ] },
      explain: t('The gaps are equality constraints; at the solution they are zero, and both methods solve the same problem. Multiple shooting changes the path to the answer, not the answer.', '缺口是等式约束，在解处为零；两种方法解的是同一个问题。多重打靶改变的是通往答案的路径，而不是答案本身。'),
    },
    // ------------------------------------------------------------------ SQP and RTI
    {
      id: 'sqp', kind: 'derive', chapter: t('One QP at a time', '一次解一个 QP'), title: t('Solve a QP, step, repeat (Gauss–Newton SQP)', '解一个 QP，走一步，再来（高斯–牛顿 SQP）'), skill: 'sqp-rti',
      intro: t('We already know how to solve QPs fast (M5). So turn the NLP into a sequence of QPs: around a guess $\\bar U$, pretend the car is linear, solve for the correction, move, repeat.', '我们已经会快速求解 QP 了（M5）。那就把这个 NLP 变成一串 QP：围绕一个猜测 $\\bar U$，假装车是线性的，解出修正量，走一步，再重复。'),
      lines: [
        { tex: '\\bar X = X(\\bar U), \\qquad A_k = \\frac{\\partial F}{\\partial x}\\Big|_{\\bar x_k, \\bar u_k}, \\quad B_k = \\frac{\\partial F}{\\partial u}\\Big|_{\\bar x_k, \\bar u_k}', why: t('Simulate the guess, and take the slopes of one step along it. They change from step to step: the linear model of M2, but **time-varying**, taken along the guess.', '把猜测仿真一遍，沿着它求每一步的斜率。斜率每一步都不同：这就是 M2 的线性模型，只不过是**时变**的，并且沿着猜测轨迹取。') },
        { tex: 'G_{k+1} = A_k G_k + \\begin{bmatrix} 0 & \\cdots & B_k & \\cdots & 0 \\end{bmatrix}, \\qquad G_0 = 0', why: t('How each predicted state moves when the inputs move: $G = \\partial X / \\partial U$, built forward. With constant $A, B$ this is exactly $\\Gamma$ from M2.', '每个预测状态随输入怎样变化：$G = \\partial X / \\partial U$，一步步往前算出来。$A, B$ 不变时，它恰好就是 M2 的 $\\Gamma$。') },
        { tex: 'X \\approx \\bar X + G\\,\\Delta U', why: t('The prediction the QP believes. It is exact only for $\\Delta U = 0$; the farther the answer is from the guess, the more it is wrong. The world below shows how wrong.', '这是 QP 所相信的预测。只有 $\\Delta U = 0$ 时它才精确；答案离猜测越远，它错得越多。后面的互动会让你看到错多少。') },
        { tex: '\\min_{\\Delta U}\\; \\lVert \\bar X + G\\Delta U - X_r \\rVert_{\\bar Q}^2 + \\lVert \\bar U + \\Delta U \\rVert_{\\bar R}^2 \\quad \\mathrm{s.t.}\\quad u_{\\min} - \\bar u_k \\le \\Delta u_k \\le u_{\\max} - \\bar u_k', why: t('Put the linear prediction into the cost: a QP in $\\Delta U$, with Hessian $2(G^\\top \\bar Q G + \\bar R)$, the M3 shape again. This is the **Gauss–Newton** approximation: it needs no second derivatives and is always positive semidefinite (Gros et al. 2020, cited on the next page).', '把线性预测代进代价：得到一个关于 $\\Delta U$ 的 QP，海森矩阵是 $2(G^\\top \\bar Q G + \\bar R)$，又是 M3 的形状。这就是**高斯–牛顿**近似：不需要二阶导数，而且总是半正定的（Gros 等 2020，下一页有出处）。') },
        { tex: 'U \\leftarrow \\bar U + \\Delta U, \\quad \\bar U \\leftarrow U, \\quad \\dots', why: t('Take the full step and linearise again. Near a solution the guesses barely change and the steps shrink; that is convergence.', '走完整的一步，再重新线性化。接近解的时候，猜测几乎不再变，步长越来越小，这就是收敛。') },
      ],
      blank: { line: 2, answer: 'Xbar + G*dU', variables: ['Xbar', 'G', 'dU'], prompt: t('Write the linearised prediction with $\\bar X$ (`Xbar`), $G$ and $\\Delta U$ (`dU`).', '用 $\\bar X$（写作 `Xbar`）、$G$ 和 $\\Delta U$（写作 `dU`）写出线性化后的预测。') },
      outro: t('Each iteration costs one linearisation plus one QP. Iterating to convergence every 0.1 s may take several of them. Does it have to?', '每次迭代要做一次线性化和一个 QP。每 0.1 秒都迭代到收敛，可能要好几次。非这样不可吗？'),
    },
    {
      id: 'rti', kind: 'read', title: t('The real-time iteration: one QP per sample', '实时迭代：每个采样只解一个 QP'),
      blocks: [
        { type: 'p', text: t('The trick of the real-time iteration (RTI) is to notice that consecutive problems are almost the same. The car moved for 0.1 s; the road ahead is the old road shifted by one point. So the plan made a sample ago, **shifted by one step**, is already close to the new solution. Linearise around it, solve **one** QP, apply its first input, and move on[^diehl02][^gros].', '实时迭代（RTI）的诀窍在于注意到：相邻两次的问题几乎一样。车只走了 0.1 秒；前面的路就是旧的路往前挪了一个点。所以上一个采样做的计划，**平移一步**，已经很接近新的解。围绕它线性化，只解**一个** QP，执行它的第一个输入，然后继续[^diehl02][^gros]。') },
        { type: 'figure', src: t('mpc/m8/rti-timeline.en.svg', 'mpc/m8/rti-timeline.zh.svg'), alt: t('Timeline: RTI prepares the QP before the measurement arrives and then solves one QP, so the delay is one QP; iterating to convergence waits for the measurement and then runs several QPs.', '时间线：RTI 在测量到来之前把 QP 准备好，测量到了只解一个 QP，延迟就是一个 QP；迭代到收敛要等测量到了再跑好几个 QP。'), credit: t('Own schematic after Diehl et al. (2002) and Gros et al. (2020, Algorithm 3)', '自绘示意图，据 Diehl 等（2002）与 Gros 等（2020，算法 3）') },
        { type: 'list', items: [
          t('**Preparation**, before the new state arrives: shift the last plan, linearise along it, build and factor the QP. None of it needs the measurement.', '**准备阶段**，新状态到来之前：平移上一个计划，沿它线性化，把 QP 搭好、分解好。这些都用不到新测量。'),
          t('**Feedback**, when $\\hat x$ arrives: put it in, solve the QP, apply $u_0$. The delay is one QP, "practically the same" as linear MPC’s[^gros].', '**反馈阶段**，$\\hat x$ 到来时：代入，解 QP，执行 $u_0$。延迟只有一个 QP，与线性 MPC "几乎相同"[^gros]。'),
        ] },
        { type: 'p', text: t('**Why is one iteration enough?** Because the start is good: when the guess is already close, the error left after one Gauss–Newton step is much smaller than the error before it (for the exact Newton step it is second order in the size of the change)[^diehl02], and the next sample keeps refining. For RTI as a whole, convergence (contractivity) and a bound on the loss of optimality have been proven[^diehl05]. The warm start is not a detail; it is what makes one QP enough. The world below lets you take it away.', '**为什么一次迭代就够？**因为起点好：猜测已经很接近时，一步高斯–牛顿之后剩下的误差远小于之前的误差（对精确的牛顿步，误差是变化量大小的二阶小量）[^diehl02]，下一个采样还会接着改进。对整个 RTI，已经证明了它的收敛性（压缩性），以及与精确最优解相比损失的上界[^diehl05]。热启动不是细节，正是它让一个 QP 就够用。下面的互动让你把它拿掉试试。') },
        { type: 'callout', kind: 'note', title: t('Linear MPC is a special case', '线性 MPC 是特例'), body: t('"Linear MPC can be regarded as an RTI scheme where the preparation phase is performed only once, off-line"[^gros]: linearise around the operating point once, and never again. RTI simply redoes that preparation along the latest plan.', '"线性 MPC 可以看作是准备阶段只在离线时做一次的 RTI"[^gros]：围绕工作点线性化一次，之后再也不做。RTI 只是沿着最新的计划把这份准备工作重新做一遍。') },
        { type: 'cite', key: 'diehl02', text: t('Diehl, Bock, Schlöder, Findeisen, Nagy & Allgöwer (2002). Real-time optimization and nonlinear model predictive control of processes governed by differential-algebraic equations. J. Process Control 12(4).', 'Diehl、Bock、Schlöder、Findeisen、Nagy、Allgöwer（2002）。Real-time optimization and nonlinear model predictive control of processes governed by differential-algebraic equations。J. Process Control 12(4)。'), url: 'https://doi.org/10.1016/S0959-1524(01)00023-3' },
        { type: 'cite', key: 'diehl05', text: t('Diehl, Bock & Schlöder (2005). A real-time iteration scheme for nonlinear optimization in optimal feedback control. SIAM J. Control Optim. 43(5).', 'Diehl、Bock、Schlöder（2005）。A real-time iteration scheme for nonlinear optimization in optimal feedback control。SIAM J. Control Optim. 43(5)。'), url: 'https://doi.org/10.1137/S0363012902400713' },
        { type: 'cite', key: 'gros', text: t('Gros, Zanon, Quirynen, Bemporad & Diehl (2020). From linear to nonlinear MPC: bridging the gap via the real-time iteration. Int. J. Control 93(1).', 'Gros、Zanon、Quirynen、Bemporad、Diehl（2020）。From linear to nonlinear MPC: bridging the gap via the real-time iteration。Int. J. Control 93(1)。'), url: 'https://publications.syscop.de/Gros2020b.pdf' },
      ],
    },
    {
      id: 'predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'sqp-rti', purpose: 'predict',
      prompt: t('Our NMPC solves **one** QP per sample. Each QP is built around a guess: either "straight ahead" (no steering, no braking, from where the car is now) or "the last plan, shifted one step". Through the S bends, what happens?', '我们的 NMPC 每个采样只解**一个** QP。每个 QP 都围绕一个猜测来建立：要么是"直行"（从车当前的位置出发，不打方向、不刹车），要么是"上一个计划，平移一步"。过 S 弯时会怎样？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('About the same: the QP corrects whatever the guess was', '差不多：不管猜测是什么，QP 都会修正过来'), misconception: 'linearise-anywhere' },
        { id: 'b', label: t('"Straight ahead" cuts the corners; the shifted plan follows the road', '"直行"会切弯；平移的计划能沿着路走'), correct: true },
        { id: 'c', label: t('"Straight ahead" leaves the lane', '"直行"会冲出车道') },
        { id: 'd', label: t('The shifted plan is worse: old information', '平移的计划更差：信息是旧的') },
      ] },
      explain: t('The QP trusts a model linearised around its guess. Around "straight ahead" that model says the car barely turns, so the QP asks for too little steering in every bend. Check it in the world, and look at how far the QP’s prediction is from the truth.', 'QP 相信的是围绕猜测线性化出来的模型。围绕"直行"，这个模型说车几乎转不了弯，于是每个弯道里 QP 要的方向都打得不够。到互动里验证一下，并看看 QP 的预测离实际有多远。'),
    },
    {
      id: 'world', kind: 'explore', title: t('One QP per sample, built around what?', '每个采样一个 QP，围绕什么建立？'), skill: 'sqp-rti',
      scene: vis('mpc_car_track', { story: 'still', t: 2.6 }),
      prompt: t(
        'The toy brief: stay within 15 cm of the lane centre (a number we chose for this exercise; the lane itself is ±1.5 m and no setting leaves it). Change **what the QP is built around** and **QPs per sample**; drag **the instant** to look at a plan. (1) Meet the brief with exactly one QP per sample. (2) Meet it starting from "straight ahead" with as few QPs as possible.',
        '玩具要求：离车道中心不超过 15 cm（这是为这个练习定的数字；车道本身是 ±1.5 m，所有设置都不会出车道）。改变 **QP 围绕什么建立** 和 **每个采样解几个 QP**；拖动 **查看的时刻** 看某一时刻的计划。（1）每个采样只解一个 QP，达到要求。（2）从"直行"出发，用尽可能少的 QP 达到要求。'),
      setup: attach('mpc_car_track', { story: 'still', t: 2.6 }),
      cue: [L10(CAR_LABELS.guess), L10(CAR_LABELS.iters), L10(CAR_LABELS.t)],
      goals: [
        { id: 'rti', check: (s: any) => { const r = s.result(); return r.iters === 1 && r.in_brief; }, message: t('One QP around the last plan shifted: 9.2 cm, as good as iterating to convergence. That is the real-time iteration.', '围绕平移后的上一个计划只解一个 QP：9.2 cm，和迭代到收敛一样好。这就是实时迭代。') },
        { id: 'cold-cheapest', check: (s: any) => { const r = s.result(); return r.guess === 'cold' && r.iters === 2; }, message: t('From "straight ahead" it takes 2 QPs per sample (12 cm), twice the work of RTI for a worse result.', '从"直行"出发，每个采样要 2 个 QP（12 cm）：工作量是 RTI 的两倍，结果还更差。') },
      ],
      detectors: [
        { id: 'converge', on: (e) => (e.type === 'setting' && e.data!.iters === 'conv' ? { kind: 'misconception', id: 'nmpc-must-converge', message: t('Converging gives 9.2 cm, the same as one warm QP, but costs 2.8 to 4.9 QPs per sample.', '迭代到收敛得到 9.2 cm，和一个热启动的 QP 一样，但每个采样要花 2.8 到 4.9 个 QP。') } : null) },
        { id: 'back-to-cold', on: (e) => (e.type === 'setting' && e.data!.guess === 'cold' && e.data!.iters === 1 ? { kind: 'misconception', id: 'linearise-anywhere', message: t('Around "straight ahead" the QP predicts a path up to 3.2 m away from what its own plan really does.', '围绕"直行"建立的 QP，预测的路径和它自己的计划实际走出的路径最多相差 3.2 m。') } : null) },
      ],
      lines: [
        { text: t('Look at the bend: the dashed purple line is what the QP thinks its plan does; the thin black line is what the plan really does.', '看弯道：紫色虚线是 QP 以为它的计划会怎么走，细黑线是这个计划实际怎么走。'), when: 'enter' },
        { text: t('Built around straight ahead, the QP believes the car barely turns, so it under-steers. The prediction and the truth peel apart.', '围绕"直行"建立时，QP 以为车几乎转不了弯，于是方向打得不够。预测和实际分道扬镳。'), when: { finding: 'linearise-anywhere' } },
        { text: t('Same path as one good QP, just more work per sample. Converging is not what makes it accurate; a good starting guess is.', '路径和一个好的 QP 一样，只是每个采样多做了几倍的工作。让它准的不是迭代到收敛，而是好的初始猜测。'), when: { finding: 'nmpc-must-converge' } },
        { text: t('Watch the purple dashes at the end of the horizon. When do they sit on the black line?', '盯住时域末端的紫色虚线。它什么时候和黑线重合？'), when: 'idle' },
        { text: t('So the shifted plan makes one QP enough. Next, the same NMPC with a real solver.', '所以，平移后的计划让一个 QP 就够了。下面用真正的求解器写同一个 NMPC。'), when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.guess.set_value(1);
        s.iters.set_value(0);
        w.emit('setting', { ...s.result() });
        s.guess.set_value(0);
        s.iters.set_value(1);
        w.emit('setting', { ...s.result() });
      },
    },
    {
      id: 'takeaway', kind: 'read', title: t('What the world showed', '互动说明了什么'),
      blocks: [
        { type: 'table', head: [t('QP built around', 'QP 围绕'), t('QPs per sample', '每个采样的 QP'), t('largest |e|', '最大 |e|'), t('slowest speed', '最低车速')], rows: [
          [t('last plan, shifted (RTI)', '上一个计划，平移（RTI）'), '1', '9.2 cm', '6.0 m/s'],
          [t('last plan, shifted', '上一个计划，平移'), t('to convergence (2.8 on average)', '到收敛（平均 2.8）'), '9.2 cm', '6.0 m/s'],
          [t('straight ahead', '直行'), '1', '32.6 cm', '5.1 m/s'],
          [t('straight ahead', '直行'), '2 / 3', '12.2 / 9.4 cm', '5.9 / 6.0 m/s'],
          [t('straight ahead', '直行'), t('to convergence (4.9 on average)', '到收敛（平均 4.9）'), '9.2 cm', '6.0 m/s'],
        ] },
        { type: 'p', text: t('The rule: **the quality of a one-QP NMPC is the quality of the point it linearises around.** A shifted plan is near the answer, so one QP lands on it. A poor guess needs more QPs, and with one QP it cuts the corners, because its linear model under-predicts the turn.', '规律是：**只解一个 QP 的 NMPC 有多好，取决于它围绕的那个点有多好。**平移后的计划已经接近答案，一个 QP 就能落到答案上。糟糕的猜测需要更多的 QP；只解一个时就会切弯，因为它的线性模型低估了车能转多少。') },
        { type: 'callout', kind: 'warning', title: t('How far this goes', '这能说明多少'), body: t('All of this is a simulation of a toy car whose plant is its own model, with a 15 cm brief we made up. No setting left the ±1.5 m lane; what separates them is how tightly they hold the line. On a real car the model is wrong too, and M7’s tools (disturbance estimates, robust margins) come back. A shorter horizon would hide the effect: with $N = 5$, even one cold QP stays within 7.6 cm, because the guess hardly matters over 0.5 s.', '以上全是玩具车的模拟，被控对象就是控制器自己的模型，15 cm 的要求也是我们定的。没有任何设置冲出 ±1.5 m 的车道；它们的区别在于贴线贴得多紧。在真车上模型也会不准，这时 M7 的工具（扰动估计、鲁棒裕度）又要派上用场。更短的时域会掩盖这个现象：$N = 5$ 时，即使只解一个"直行"的 QP 也能保持在 7.6 cm 以内，因为 0.5 秒内猜测好坏几乎没有影响。') },
      ],
    },
    // ------------------------------------------------------------------ tools and uses
    {
      id: 'code', kind: 'code', chapter: t('Tools and real uses', '工具与真实应用'), title: t('The same NMPC in CasADi', '用 CasADi 写同一个 NMPC'),
      intro: t('You do not write Gauss–Newton by hand in practice. Here is the same car, road, cost and limits in CasADi with Ipopt, in multiple shooting and warm-started with the shifted solution. We ran it offline (Python 3.12, CasADi 3.8.1): it prints `largest |e| = 9.3 cm, Ipopt iterations per sample: 5 to 5`, matching the converged world result (9.2 cm; the 1 mm comes from a coarser road lookup). With a cold start every sample it gave the same 9.3 cm with 5 to 8 Ipopt iterations. Copy it and run it on any laptop (`pip install casadi numpy`).', '实际工作中不会手写高斯–牛顿。下面是同一辆车、同一条路、同样的代价和约束，用 CasADi 加 Ipopt 来写，采用多重打靶，并用平移后的解做热启动。我们在线下运行过（Python 3.12，CasADi 3.8.1）：输出 `largest |e| = 9.3 cm, Ipopt iterations per sample: 5 to 5`，与互动里迭代到收敛的结果（9.2 cm）一致（1 mm 的差别来自更粗的道路查表）。如果每个采样都冷启动，结果同样是 9.3 cm，Ipopt 每次要迭代 5 到 8 次。复制下来就能在任何笔记本上运行（`pip install casadi numpy`）。'),
      lang: 'python', code: CASADI,
      notes: [
        { lines: [5, 12], text: t('The model and one RK4 step $F$, written with CasADi symbols so that derivatives come for free (automatic differentiation).', '模型和一步 RK4 积分 $F$，用 CasADi 的符号写，这样导数可以自动求出（自动微分）。') },
        { lines: [14, 22], text: t('The S road, sampled every 5 cm; the reference takes one point every 0.6 m ahead.', 'S 形路，每 5 cm 采一个点；参考值往前每 0.6 m 取一个点。') },
        { lines: [25, 27], text: t('Multiple shooting: both the states $X$ and the inputs $U$ are decision variables; the current state, the reference and the last input are parameters.', '多重打靶：状态 $X$ 和输入 $U$ 都是决策变量；当前状态、参考值和上一个输入是参数。'), shapes: 'X: [4, N+1]  U: [2, N]  ref: [4, N]' },
        { lines: [29, 34], text: t('The cost (same weights as the world) and the gap constraints $x_{k+1} = F(x_k, u_k)$.', '代价（权重与互动中相同）和缺口约束 $x_{k+1} = F(x_k, u_k)$。') },
        { lines: [35, 39], text: t('The limits and Ipopt, which returns a local solution.', '约束，以及返回局部解的 Ipopt。') },
        { lines: [48, 54], text: t('The warm start: the last solution shifted one step becomes the next initial guess. Only the first input is applied.', '热启动：把上一个解平移一步，作为下一次的初始猜测。只执行第一个输入。') },
      ],
    },
    {
      id: 'tools', kind: 'read', title: t('Tools, and where nonlinear MPC runs', '工具，以及非线性 MPC 用在哪里'),
      blocks: [
        { type: 'table', head: [t('tool', '工具'), t('what it is for', '用来做什么')], rows: [
          [t('CasADi', 'CasADi'), t('Modelling and automatic differentiation for optimal control, with solver plug-ins (Ipopt, QP solvers) and C code export; Python, MATLAB[^casadi]', '最优控制的建模与自动微分，带求解器插件（Ipopt、QP 求解器），可导出 C 代码；支持 Python、MATLAB[^casadi]')],
          [t('Ipopt', 'Ipopt'), t('General interior-point NLP solver; finds a local solution[^ipopt]', '通用内点法 NLP 求解器；找局部解[^ipopt]')],
          [t('acados', 'acados'), t('Fast embedded NMPC in C: multiple shooting, SQP-type solvers, HPIPM, models from CasADi[^acados]', '用 C 写的快速嵌入式 NMPC：多重打靶、SQP 类求解器、HPIPM，模型来自 CasADi[^acados]')],
          [t('do-mpc', 'do-mpc'), t('Python toolbox for nonlinear and robust (multi-stage) MPC and estimation[^dompc]', '用于非线性与鲁棒（多阶段）MPC 及状态估计的 Python 工具箱[^dompc]')],
        ] },
        { type: 'p', text: t('Prototype in CasADi with Ipopt; when it must run every few milliseconds on a robot, generate RTI code (acados, or ACADO as in the drone below).', '用 CasADi 加 Ipopt 做原型；要在机器人上每几毫秒跑一次时，生成 RTI 代码（acados，或者下面无人机用的 ACADO）。') },
        { type: 'list', items: [
          t('**A drone (pointer to the quadrotor case).** On a hexacopter tracking trajectories in wind, linear MPC and RTI nonlinear MPC both ran at 100 Hz over a 2 s horizon (20 steps, like our car). The NMPC solved in 0.45 ms on average against 2.35 ms for the linear MPC, and tracked with 7.1 cm instead of 10.8 cm error[^kamel]. On their setup, thanks to RTI and generated code; not a general rule.', '**无人机（四旋翼的一个例子）。**一架六旋翼在风中跟踪轨迹，线性 MPC 和 RTI 非线性 MPC 都以 100 Hz 运行，时域 2 秒（20 步，和我们的车一样）。NMPC 平均求解 0.45 ms，线性 MPC 是 2.35 ms；跟踪误差 7.1 cm 对 10.8 cm[^kamel]。这是在他们的设置下、得益于 RTI 和代码生成的结果，不是普遍规律。'),
          t('**A car on ice.** MPC computing the front steering angle on slippery roads, in two versions: a full nonlinear model, and the model re-linearised at every step (cheaper); tested up to 21 m/s on icy roads[^falcone].', '**冰面上的车。**在湿滑路面上用 MPC 计算前轮转角，做了两个版本：完整的非线性模型，以及每一步重新线性化的模型（更便宜）；在冰面上测试到 21 m/s[^falcone]。'),
          t('**Industry is mostly linear.** A survey of vendors (a mid-1999 snapshot) counted 4542 linear MPC applications and 93 nonlinear ones; nonlinear ones were smaller, "likely due to the computational complexity"[^qin].', '**工业界大多是线性 MPC。**一项对供应商的调查（1999 年中的快照）统计到 4542 个线性 MPC 应用、93 个非线性的；非线性的规模更小，"很可能是因为计算复杂"[^qin]。'),
        ] },
        { type: 'cite', key: 'casadi', text: t('Andersson, Gillis, Horn, Rawlings & Diehl (2019). CasADi. Math. Prog. Comp. 11(1).', 'Andersson、Gillis、Horn、Rawlings、Diehl（2019）。CasADi。Math. Prog. Comp. 11(1)。'), url: 'https://web.casadi.org/' },
        { type: 'cite', key: 'ipopt', text: t('Wächter & Biegler (2006). On the implementation of an interior-point filter line-search algorithm for large-scale nonlinear programming. Math. Prog. 106(1). Project page.', 'Wächter、Biegler（2006）。On the implementation of an interior-point filter line-search algorithm for large-scale nonlinear programming。Math. Prog. 106(1)。项目主页。'), url: 'https://coin-or.github.io/Ipopt/' },
        { type: 'cite', key: 'acados', text: t('Verschueren et al. (2022). acados: a modular open-source framework for fast embedded optimal control. Math. Prog. Comp. 14(1).', 'Verschueren 等（2022）。acados: a modular open-source framework for fast embedded optimal control。Math. Prog. Comp. 14(1)。'), url: 'https://docs.acados.org/' },
        { type: 'cite', key: 'dompc', text: t('Fiedler et al. (2023). do-mpc: Towards FAIR nonlinear and robust model predictive control. Control Eng. Practice 140.', 'Fiedler 等（2023）。do-mpc: Towards FAIR nonlinear and robust model predictive control。Control Eng. Practice 140。'), url: 'https://www.do-mpc.com/' },
        { type: 'cite', key: 'kamel', text: t('Kamel, Burri & Siegwart (2017). Linear vs nonlinear MPC for trajectory tracking applied to rotary wing micro aerial vehicles. IFAC-PapersOnLine 50(1).', 'Kamel、Burri、Siegwart（2017）。Linear vs nonlinear MPC for trajectory tracking applied to rotary wing micro aerial vehicles。IFAC-PapersOnLine 50(1)。'), url: 'https://arxiv.org/abs/1611.09240' },
        { type: 'cite', key: 'falcone', text: t('Falcone, Borrelli, Asgari, Tseng & Hrovat (2007). Predictive active steering control for autonomous vehicle systems. IEEE TCST 15(3).', 'Falcone、Borrelli、Asgari、Tseng、Hrovat（2007）。Predictive active steering control for autonomous vehicle systems。IEEE TCST 15(3)。'), url: 'https://doi.org/10.1109/TCST.2007.894653' },
        { type: 'cite', key: 'qin', text: t('Qin & Badgwell (2003). A survey of industrial model predictive control technology. Control Eng. Practice 11(7), Tables 6–7.', 'Qin、Badgwell（2003）。A survey of industrial model predictive control technology。Control Eng. Practice 11(7)，表 6–7。'), url: 'https://doi.org/10.1016/S0967-0661(02)00186-7' },
      ],
    },
    {
      id: 'learning', kind: 'read', title: t('Learning and MPC', '学习与 MPC'),
      blocks: [
        { type: 'p', text: t('MPC needs a model; learning needs data. The research on combining them falls into three groups[^hewing]:', 'MPC 需要模型，学习需要数据。把两者结合起来的研究可以分成三类[^hewing]：') },
        { type: 'list', ordered: true, items: [
          t('**Learn the model** from recorded data, then do MPC with it (most of the work).', '**从记录的数据中学模型**，再用它做 MPC（大部分工作属于这一类）。'),
          t('**Learn the MPC’s own design**: its cost, constraints or terminal ingredients. Learning MPC, for example, builds the terminal set and cost of M6 from past laps of the same task, and its cost never gets worse from lap to lap[^rosolia].', '**学 MPC 自己的设计**：代价、约束或终端项。比如 Learning MPC 用同一任务以往各圈的数据构造 M6 讲的终端集和终端代价，而且一圈比一圈的代价不会变差[^rosolia]。'),
          t('**Use MPC to keep a learned controller safe**: the learned policy proposes, an MPC-style filter keeps the constraints.', '**用 MPC 给学来的控制器保驾**：学到的策略提出动作，一个 MPC 式的过滤器保证约束。'),
        ] },
        { type: 'p', text: t('A fourth link goes the other way: compute the linear MPC law (piecewise affine, M4) offline and fit a neural network to it, which is cheap to evaluate on small chips; the approximation error then has to be checked or corrected[^karg].', '还有一条反方向的联系：离线算出线性 MPC 的控制律（M4 讲的分段仿射），再用神经网络去拟合它，网络在小芯片上算起来很便宜；不过近似误差需要另外检查或修正[^karg]。') },
        { type: 'callout', kind: 'open', title: t('MPC or reinforcement learning?', 'MPC 还是强化学习？'), body: t('Contested, and moving fast. One data point: on the double integrator (our cart), a model fitted from 10 samples gave near-optimal control, while policy gradient needed "thousands of times as many samples", and model-free methods "fail to be safe" on a harder instance[^recht]. When a good model exists and constraints matter, use it; when no model can be written and a simulator gives cheap, safe trials, RL becomes attractive. Many systems now combine the two.', '这个问题有争议，而且变化很快。一个数据点：在二重积分器（就是我们的小车）上，用 10 个样本拟合出的模型就能给出接近最优的控制，而策略梯度需要"多几千倍的样本"，在更难的例子上无模型方法还"不安全"[^recht]。有好模型、约束又重要时，就用模型；写不出模型、又有模拟器能提供廉价且安全的试错时，强化学习就有吸引力。现在很多系统把两者结合起来用。') },
        { type: 'cite', key: 'hewing', text: t('Hewing, Wabersich, Menner & Zeilinger (2020). Learning-based model predictive control: toward safe learning in control. Annu. Rev. Control Robot. Auton. Syst. 3.', 'Hewing、Wabersich、Menner、Zeilinger（2020）。Learning-based model predictive control: toward safe learning in control。Annu. Rev. Control Robot. Auton. Syst. 3。'), url: 'https://doi.org/10.1146/annurev-control-090419-075625' },
        { type: 'cite', key: 'rosolia', text: t('Rosolia & Borrelli (2018). Learning model predictive control for iterative tasks. IEEE TAC 63(7).', 'Rosolia、Borrelli（2018）。Learning model predictive control for iterative tasks。IEEE TAC 63(7)。'), url: 'https://arxiv.org/abs/1609.01387' },
        { type: 'cite', key: 'karg', text: t('Karg & Lucia (2020). Efficient representation and approximation of model predictive control laws via deep learning. IEEE Trans. Cybernetics 50(9).', 'Karg、Lucia（2020）。Efficient representation and approximation of model predictive control laws via deep learning。IEEE Trans. Cybernetics 50(9)。'), url: 'https://arxiv.org/abs/1806.10644' },
        { type: 'cite', key: 'recht', text: t('Recht (2019). A tour of reinforcement learning: the view from continuous control. Annu. Rev. Control Robot. Auton. Syst. 2.', 'Recht（2019）。A tour of reinforcement learning: the view from continuous control。Annu. Rev. Control Robot. Auton. Syst. 2。'), url: 'https://arxiv.org/abs/1806.09460' },
      ],
    },
    // ------------------------------------------------------------------ how to choose
    {
      id: 'choose', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('PID, LQR, MPC, nonlinear MPC or RL?', 'PID、LQR、MPC、非线性 MPC 还是强化学习？'),
      blocks: [
        { type: 'p', text: t('Four questions decide it: is there a model, do the limits matter, how much computing time is there per sample, and how much data or trial is affordable.', '决定选择的是四个问题：有没有模型，约束要不要紧，每个采样有多少计算时间，以及能承受多少数据或试错。') },
        { type: 'table', head: [t('controller', '控制器'), t('model needed', '需要的模型'), t('online work per sample', '每个采样的在线计算'), t('limits', '约束'), t('data needed', '需要的数据')], rows: [
          [t('**PID**', '**PID**'), t('none in the controller; tuned on the plant', '控制器里没有；在对象上整定'), t('trivial', '几乎为零'), t('not in the design; add-ons (clipping, anti-windup, select logic)[^qin2]', '不在设计里；靠外加手段（限幅、抗积分饱和、选择逻辑）[^qin2]'), t('tuning experiments', '整定实验')],
          [t('**LQR** (M3)', '**LQR**（M3）'), t('linear $A, B$', '线性的 $A, B$'), t('$u = -Kx$, Riccati offline', '$u = -Kx$，Riccati 离线算好'), t('none; a saturated LQR can do badly[^qin2]', '没有；LQR 一饱和可能表现很差[^qin2]'), t('a model', '一个模型')],
          [t('**linear MPC**', '**线性 MPC**'), t('linear model (+ disturbance model, M7)', '线性模型（+ 扰动模型，M7）'), t('one QP: under 1 ms on a legged robot[^cheetah], once a minute in refineries[^qin2]', '一个 QP：腿式机器人上不到 1 ms[^cheetah]，炼油厂里每分钟一次[^qin2]'), t('explicit, by design (M4)', '显式写进设计（M4）'), t('a model, often from step tests', '一个模型，常来自阶跃测试')],
          [t('**nonlinear MPC**', '**非线性 MPC**'), t('nonlinear model', '非线性模型'), t('one NLP, or with RTI one QP plus a linearisation', '一个 NLP；用 RTI 则是一个 QP 加一次线性化'), t('explicit, nonlinear; local solutions', '显式、可以是非线性的；解是局部的'), t('a model', '一个模型')],
          [t('**RL**', '**强化学习**'), t('none (or learned)', '不需要（或者学出来）'), t('cheap to run a trained policy', '训练好的策略运行起来很便宜'), t('no built-in guarantee', '没有内在保证'), t('a lot: many safe trials or a simulator[^recht2]', '很多：大量安全的试错，或者一个模拟器[^recht2]')],
        ] },
        { type: 'list', ordered: true, items: [
          t('**No limit that matters, one loop, no model?** PID. It is still the base layer under most MPCs in industry, run every second while the MPC runs every minute[^qin2].', '**没有要紧的约束、单回路、没有模型？**用 PID。在工业界它至今仍是大多数 MPC 下面的基础层：PID 每秒运行，MPC 每分钟运行一次[^qin2]。'),
          t('**A good linear model, limits rarely reached?** LQR: optimal feedback for free at run time.', '**线性模型很好、约束很少碰到？**用 LQR：运行时几乎不花计算就能得到最优反馈。'),
          t('**Limits that matter, and a linear model good near the operating point?** Linear MPC: one QP per sample.', '**约束要紧，线性模型在工作点附近又足够准？**用线性 MPC：每个采样一个 QP。'),
          t('**Limits that matter and a nonlinearity that matters** (large steering, a wide speed range, as in our S)? Nonlinear MPC, with RTI when time is tight.', '**约束要紧，非线性也要紧**（方向打得大、速度范围宽，就像我们的 S 弯）？用非线性 MPC；时间紧就用 RTI。'),
          t('**No model you can write, but cheap safe trials?** RL, or learn a model and use MPC; keep an MPC-style safety filter if constraints are hard.', '**写不出模型，但能便宜又安全地试错？**用强化学习，或者先学一个模型再用 MPC；如果约束是硬的，保留一个 MPC 式的安全过滤器。'),
        ] },
        { type: 'callout', kind: 'misconception', title: t('Counterexamples', '反例'), body: t('"MPC is always better": a thermostat with a heater that never saturates gains nothing from a QP solver, and an MPC with a wrong model can do worse than a well-tuned PID. "Nonlinear means NMPC": GM’s production engine controller uses a set of linear MPCs scheduled on the operating point, each with its own Kalman filter[^gm]. "A drone is too fast for NMPC": with RTI it ran at 100 Hz[^kamel2].', '"MPC 总是更好"：一个加热器从不饱和的恒温器，用 QP 求解器毫无收益；模型不对的 MPC 可能还不如整定好的 PID。"非线性就该用 NMPC"：通用汽车量产的发动机控制器用的是一组按工作点切换的线性 MPC，每个都配有自己的卡尔曼滤波器[^gm]。"无人机太快，用不了 NMPC"：用了 RTI，它照样以 100 Hz 运行[^kamel2]。') },
        { type: 'p', text: t('The table and the path are our synthesis of the sources below, not a rule from any one of them.', '这张表和这条决策路径是我们根据下面的资料归纳出来的，不是哪一篇文献给出的规则。') },
        { type: 'cite', key: 'qin2', text: t('Qin & Badgwell (2003), Fig. 2 and §5–6.', 'Qin、Badgwell（2003），图 2 与 §5–6。'), url: 'https://doi.org/10.1016/S0967-0661(02)00186-7' },
        { type: 'cite', key: 'cheetah', text: t('Di Carlo, Wensing, Katz, Bledt & Kim (2018). Dynamic locomotion in the MIT Cheetah 3 through convex model-predictive control. IROS.', 'Di Carlo、Wensing、Katz、Bledt、Kim（2018）。Dynamic locomotion in the MIT Cheetah 3 through convex model-predictive control。IROS。'), url: 'https://doi.org/10.1109/IROS.2018.8594448' },
        { type: 'cite', key: 'recht2', text: t('Recht (2019). A tour of reinforcement learning.', 'Recht（2019）。A tour of reinforcement learning。'), url: 'https://arxiv.org/abs/1806.09460' },
        { type: 'cite', key: 'gm', text: t('Bemporad, Bernardini, Long & Verdejo (2018). Model predictive control of turbocharged gasoline engines for mass production. SAE 2018-01-0875.', 'Bemporad、Bernardini、Long、Verdejo（2018）。Model predictive control of turbocharged gasoline engines for mass production。SAE 2018-01-0875。'), url: 'https://doi.org/10.4271/2018-01-0875' },
        { type: 'cite', key: 'kamel2', text: t('Kamel, Burri & Siegwart (2017). IFAC-PapersOnLine 50(1).', 'Kamel、Burri、Siegwart（2017）。IFAC-PapersOnLine 50(1)。'), url: 'https://arxiv.org/abs/1611.09240' },
      ],
    },
    // ------------------------------------------------------------------ checks
    {
      id: 'q-speed', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('How fast before the model breaks?', '多快模型就不灵了？'), skill: 'vehicle-model', purpose: 'check',
      prompt: t('On a dry road ($\\mu = 1$, $g = 9.81$ m/s²) the kinematic bicycle model is trusted while the lateral acceleration stays below $0.5\\,\\mu g$. Up to what speed can the car drive our 9 m bends?', '在干燥路面上（$\\mu = 1$，$g = 9.81$ m/s²），只要侧向加速度低于 $0.5\\,\\mu g$，就可以信任运动学自行车模型。在我们半径 9 m 的弯道上，车速最高能到多少？'),
      question: { type: 'number', answer: 6.64, tolerance: 0.1, unit: 'm/s', wrong: [
        { answer: 9.4, feedback: t('That is $\\sqrt{\\mu g R}$, the full friction limit. The model is trusted only up to half of that acceleration.', '这是 $\\sqrt{\\mu g R}$，即摩擦力的极限。模型只在这个加速度的一半以内可信。'), misconception: 'kinematic-always-valid' },
        { answer: 44.1, feedback: t('That is $v^2$; take the square root.', '这是 $v^2$，还要开平方。') },
      ] },
      explain: t('$v^2 / R \\le 0.5\\,\\mu g$ gives $v \\le \\sqrt{0.5 \\times 9.81 \\times 9} \\approx 6.6$ m/s. Our 6 m/s is just inside; faster, or on a wet road (smaller $\\mu$), switch to a dynamic model with tyre forces.', '$v^2 / R \\le 0.5\\,\\mu g$，得 $v \\le \\sqrt{0.5 \\times 9.81 \\times 9} \\approx 6.6$ m/s。我们的 6 m/s 刚好在范围内；再快，或者路面湿滑（$\\mu$ 更小），就要换成带轮胎力的动力学模型。'),
    },
    {
      id: 'q-guess', kind: 'checkpoint', title: t('A plan that no longer fits', '计划不再适用'), skill: 'sqp-rti', purpose: 'check',
      prompt: t('An RTI controller drives a car. A pedestrian forces an emergency stop; a few seconds later the car starts again from rest. What should the first QP after the restart be built around?', '一台 RTI 控制器在开车。行人迫使车紧急停下；几秒后车从静止重新起步。重新起步后的第一个 QP 应该围绕什么建立？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('The plan from before the stop, shifted by the number of samples that passed', '停车前的那个计划，平移过去了多少个采样就移多少步'), misconception: 'linearise-anywhere', feedback: t('That plan assumed 6 m/s and a car farther along the road: a guess far from the new solution, the cold-start problem again.', '那个计划假设车速 6 m/s、车已经开到更前面：离新解很远的猜测，又是冷启动的问题。') },
        { id: 'b', label: t('A guess that fits the new situation (for example a plan for pulling away from rest), then iterate more than once until the plans are good again', '一个符合新情况的猜测（比如一个从静止起步的计划），并且先多迭代几次，直到计划重新变好'), correct: true },
        { id: 'c', label: t('Anything: one QP corrects any guess', '随便：一个 QP 能修正任何猜测'), misconception: 'linearise-anywhere' },
        { id: 'd', label: t('Nothing: switch to a linear MPC for good', '不用管：永久换成线性 MPC') },
      ] },
      explain: t('RTI relies on consecutive problems being close. After a jump (a restart, a new route, a big disturbance), give it a guess that fits and let it iterate until it has caught up; then one QP per sample is enough again.', 'RTI 依赖相邻两次问题彼此接近。一旦出现跳变（重新起步、换路线、大扰动），就给它一个合适的猜测，让它多迭代几次赶上来；之后每个采样一个 QP 又够用了。'),
    },
    {
      id: 'q-choose', kind: 'checkpoint', title: t('Pick a controller', '选一个控制器'), skill: 'choose-controller', purpose: 'check',
      prompt: t('A warehouse robot drives at walking speed along painted lines with gentle curves; its motors never reach their limits, and a good linear model exists around straight driving. The team proposes nonlinear MPC "to be safe". What do you suggest?', '一台仓库机器人沿着画好的线以步行速度行驶，弯道很缓；电机从不达到极限，围绕直行也有很好的线性模型。团队提议"保险起见"用非线性 MPC。你建议什么？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Nonlinear MPC with RTI: it can only be better', '用带 RTI 的非线性 MPC：只会更好'), misconception: 'fanciest-controller' },
        { id: 'b', label: t('LQR (or PID on the line offset): no limits are hit and the linear model is good, so nothing is gained from online optimisation', 'LQR（或者对偏离线的距离用 PID）：约束碰不到、线性模型又好，在线优化带不来任何好处'), correct: true },
        { id: 'c', label: t('RL trained in simulation', '在模拟器里训练强化学习'), misconception: 'fanciest-controller' },
        { id: 'd', label: t('Linear MPC with a very long horizon', '用时域很长的线性 MPC') },
      ] },
      explain: t('MPC earns its cost when limits matter; NMPC when the nonlinearity matters too. Here neither does. If later the robot must squeeze past obstacles at its speed limit, linear MPC comes in; if it must corner hard at speed, NMPC.', 'MPC 只在约束要紧时才物有所值；NMPC 则还要求非线性也要紧。这里两者都不成立。如果以后机器人要贴着速度上限绕过障碍物，就该上线性 MPC；如果要高速急转弯，就该上 NMPC。'),
    },
    {
      id: 'q-explain', kind: 'checkpoint', title: t('Explain it', '解释一下'), skill: 'sqp-rti', purpose: 'check',
      prompt: t('A colleague says: "Nonlinear MPC can’t run at 100 Hz, because every sample you have to solve a nonlinear program to convergence." Answer in two or three sentences.', '同事说："非线性 MPC 跑不到 100 Hz，因为每个采样都得把非线性规划解到收敛。"用两三句话回答。'),
      question: { type: 'text', placeholder: t('You don’t have to converge, because…', '不必解到收敛，因为……'), rubric: {
        key_points: [
          t('The real-time iteration solves only one QP per sample (one Gauss–Newton/SQP step), not the NLP to convergence.', '实时迭代每个采样只解一个 QP（一步高斯–牛顿/SQP），而不是把 NLP 解到收敛。'),
          t('It works because the warm start (the last plan shifted) is already close to the new solution, so one step lands near it, and later samples keep refining.', '它之所以可行，是因为热启动（平移后的上一个计划）已经很接近新的解，一步就能落到附近，之后的采样还会继续改进。'),
          t('Linearising and building the QP happen before the measurement arrives, so the delay is about one QP, similar to linear MPC (e.g. 0.45 ms on a hexacopter at 100 Hz).', '线性化和搭建 QP 在测量到来之前完成，所以延迟大约只有一个 QP，与线性 MPC 相当（例如六旋翼上 100 Hz 时 0.45 ms）。'),
        ],
        model_answer: t('It doesn’t have to converge: the real-time iteration does one Gauss–Newton step, one QP, per sample. Starting from the last plan shifted, which is already close to the answer, one step is enough and the next samples keep refining; and since the linearisation is prepared before the measurement arrives, the delay is one QP, like linear MPC (a hexacopter ran it at 100 Hz, 0.45 ms on average).', '不必解到收敛：实时迭代每个采样只做一步高斯–牛顿，也就是一个 QP。它从平移后的上一个计划出发，这个计划已经接近答案，所以一步就够，之后的采样还会接着改进；而且线性化在测量到来之前就准备好了，延迟只有一个 QP，与线性 MPC 相当（一架六旋翼以 100 Hz 运行，平均每次 0.45 ms）。'),
        min_points: 2,
      } },
    },
  ],
};

