// M2 The model: from physics to prediction. Turn the cart's physics into a
// discrete-time model (exact zero-order hold, why not Euler), unroll it into
// one matrix formula for the whole plan, X = Φx₀ + ΓU, and see why its being
// linear in the plan U is what makes MPC a QP. Plan: docs/lessons/mpc/README.md
// (M2); design and numbers: checkpoints/m2.md; sources: research-m2.md. Every
// number about the cart is a simulation of the course's toy model
// (bars_math.test.ts).
import type { Lesson } from '@mathnim/core';
import { bar_label, mpc_bars_math } from '@mathnim/visuals/mpc';
import { attach, t, vis } from './common';

const PREDICT_CODE = `import numpy as np
from scipy.linalg import expm

dt, N = 0.1, 10
Ac = np.array([[0., 1.], [0., 0.]])      # p' = v, v' = a
Bc = np.array([[0.], [1.]])
# exact zero-order hold: one matrix exponential of the augmented system
M = expm(np.block([[Ac, Bc], [np.zeros((1, 3))]]) * dt)
A, B = M[:2, :2], M[:2, 2:]
print(A.round(6), B.round(6))           # [[1, 0.1], [0, 1]]  [[0.005], [0.1]]

n, m = B.shape
Phi = np.vstack([np.linalg.matrix_power(A, k) for k in range(1, N + 1)])
Gamma = np.zeros((n * N, m * N))
for k in range(1, N + 1):                # block row k predicts x_k
    for j in range(k):                   # only the inputs before k
        Gamma[(k-1)*n:k*n, j*m:(j+1)*m] = np.linalg.matrix_power(A, k-1-j) @ B

x0 = np.array([9.7, 0.5])                # 30 cm before the wall, 0.5 m/s
U = np.array([0, 0, 0, -.5, -1, -1, -1, -1, -.5, 0])
X = Phi @ x0 + Gamma @ U
print(X[-2:].round(6))                   # p_10, v_10 = [10.  0.]

x = x0.copy()                            # the same, one step at a time
for u in U:
    x = A @ x + B[:, 0] * u
print(np.allclose(x, X[-2:]))            # True`;

const en_label = (en: string, _zh: string) => en;
const zh_label = (_en: string, zh: string) => zh;

export const lesson: Lesson = {
  id: 'mpc-m2-model',
  title: t('The model: from physics to prediction', '模型：从物理到预测'),
  description: t(
    'Turn the cart’s physics into a step-by-step model, predict a whole plan with one matrix formula X = Φx₀ + ΓU, and see why its being linear in the plan is what makes MPC solvable.',
    '把小车的物理规律变成一步一步的模型，用一个矩阵公式 X = Φx₀ + ΓU 预测整个计划，并看清：预测对计划是线性的，正是 MPC 解得动的原因。'),
  mode: 'essay',
  skills: [
    { id: 'discretize', name: t('Discretizing with a zero-order hold', '用零阶保持离散化') },
    { id: 'stack-predictions', name: t('Stacking predictions: X = Φx₀ + ΓU', '把预测叠起来：X = Φx₀ + ΓU'), prerequisites: ['discretize'] },
    { id: 'input-timing', name: t('How an input’s timing enters the prediction', '输入的时机怎样进入预测'), prerequisites: ['stack-predictions'] },
    { id: 'linear-qp', name: t('Why linear predictions make MPC a QP', '为什么线性预测让 MPC 成为 QP'), prerequisites: ['stack-predictions'] },
  ],
  misconceptions: [
    { id: 'timing-irrelevant', description: t('Only the total amount of braking matters, not when it happens.', '只有刹车的总量要紧，什么时候刹无所谓。') },
    { id: 'more-brake-safer', description: t('Braking more than needed is always the safe side.', '多刹一点总是更保险。') },
    { id: 'euler-good-enough', description: t('Forward Euler is close enough at a small step, so its error does not matter for planning.', '步长小的时候前向欧拉就够准了，它的误差对规划没影响。') },
    { id: 'future-input-acts', description: t('A later input can change an earlier predicted state.', '后面的输入也能改变前面的预测状态。') },
    { id: 'linear-means-simple', description: t('Linear predictions matter only because they are faster to compute.', '预测是线性的，好处只是算得快一点。') },
  ],
  steps: [
    // ---------------------------------------------------------------- 1. why
    {
      id: 'why', kind: 'read', chapter: t('Why a model', '为什么要模型'), title: t('A planner is only as good as its predictions', '规划好不好，全看预测准不准'),
      blocks: [
        { type: 'p', text: t(
          'In M1 the planner kept asking one question: *if I apply these $N$ accelerations, where will the cart be, step by step?* It needed the answer for every plan it considered, and the wall only stopped the cart because the prediction said "this plan crosses 10 m". The rule that answers that question is the **model**.',
          'M1 里的规划器一直在问同一个问题：*如果我按这 $N$ 个加速度去开，小车每一步会在哪？* 它考虑的每个计划都要回答一遍；墙之所以拦得住小车，只是因为预测说了一句"这个计划会越过 10 米"。回答这个问题的规则，就是**模型**。') },
        { type: 'p', text: t('An MPC model has to do three things at once:', 'MPC 的模型要同时做到三件事：') },
        { type: 'list', items: [
          t('**be right** about the system, at the controller’s own sampling time;', '**准**：在控制器自己的采样周期上，对系统的描述是对的；'),
          t('**be cheap**, because the optimizer evaluates it over and over, every sample;', '**快**：优化器每个采样周期都要反复用它；'),
          t('**have the right shape**, so that the optimization stays easy.', '**形状对**：让优化问题保持好解。'),
        ] },
        { type: 'p', text: t(
          'This lesson builds the cart’s model from physics and checks all three. The third one is the surprise: the predictions come out **linear in the plan**, and that single fact is why MPC can be solved fast and reliably (M3, M4).',
          '这节课从物理出发，把小车的模型搭出来，三件事逐一核对。第三件最出人意料：预测对计划是**线性**的，而 MPC 之所以能解得又快又稳（M3、M4），靠的就是这一点。') },
      ],
    },
    // ---------------------------------------------------------------- 2. discretize
    {
      id: 'discretize', kind: 'derive', chapter: t('From physics to steps', '从物理到"一步一步"'), title: t('One step of the cart', '小车的一步'), skill: 'discretize',
      intro: t(
        'Physics runs in continuous time, but the controller acts in steps: every $\\Delta t = 0.1$ s it measures, decides an acceleration, and **holds** it until the next sample (a zero-order hold). So the question is: given $x_k = (p_k, v_k)$ and the held $a_k$, where is the cart one sample later?',
        '物理是连续时间的，控制器却是一步一步做事：每隔 $\\Delta t = 0.1$ 秒测一次、定一个加速度，然后把它**保持**到下一次采样（零阶保持）。所以问题是：已知 $x_k = (p_k, v_k)$ 和被保持住的 $a_k$，一个采样周期后小车在哪？'),
      lines: [
        { tex: '\\dot p = v, \\quad \\dot v = a \\qquad\\Longleftrightarrow\\qquad \\dot x = \\begin{bmatrix} 0 & 1 \\\\ 0 & 0 \\end{bmatrix} x + \\begin{bmatrix} 0 \\\\ 1 \\end{bmatrix} a', why: t('The cart as a double integrator: we command acceleration, it integrates once into speed and again into position. $x = (p, v)$ is the state: with the future inputs, these two numbers fix the whole future.', '小车是一个"双积分器"：我们给加速度，积分一次得到速度，再积分一次得到位置。$x = (p, v)$ 是状态：知道这两个数和以后的输入，整个未来就定了。') },
        { tex: 'v_{k+1} = v_k + \\Delta t\\, a_k', why: t('A constant acceleration for $\\Delta t$ seconds adds $\\Delta t\\, a_k$ to the speed.', '加速度在 $\\Delta t$ 秒内不变，速度就增加 $\\Delta t\\, a_k$。') },
        { tex: 'p_{k+1} = p_k + \\Delta t\\, v_k + \\tfrac12 \\Delta t^2 a_k', why: t('Distance is the area under $v(t)$. Inside the step $v$ rises in a straight line, so the area is a rectangle $\\Delta t\\, v_k$ plus a triangle $\\tfrac12 \\Delta t^2 a_k$ (figure on the next page).', '距离是 $v(t)$ 下面的面积。这一步里 $v$ 沿直线上升，所以面积是一个矩形 $\\Delta t\\, v_k$ 加一个三角形 $\\tfrac12 \\Delta t^2 a_k$（下一页有图）。') },
        { tex: 'x_{k+1} = \\underbrace{\\begin{bmatrix} 1 & \\Delta t \\\\ 0 & 1 \\end{bmatrix}}_{A} x_k + \\underbrace{\\begin{bmatrix} \\tfrac12 \\Delta t^2 \\\\ \\Delta t \\end{bmatrix}}_{B} u_k', why: t('The same two lines as a matrix. $A$ is what happens with no input, coasting: position gains $\\Delta t \\cdot v$, speed stays. $B$ is what one held push does: $\\Delta t$ more speed and $\\tfrac12 \\Delta t^2$ more position per unit of $u_k = a_k$.', '把上面两行写成矩阵。$A$ 是没有输入时发生的事，也就是滑行：位置增加 $\\Delta t \\cdot v$，速度不变。$B$ 是一次被保持的推力带来的变化：每单位 $u_k = a_k$，速度多 $\\Delta t$，位置多 $\\tfrac12 \\Delta t^2$。') },
        { tex: '\\Delta t = 0.1: \\quad A = \\begin{bmatrix} 1 & 0.1 \\\\ 0 & 1 \\end{bmatrix}, \\quad B = \\begin{bmatrix} 0.005 \\\\ 0.1 \\end{bmatrix}', why: t('Exactly the numbers M1’s planner used.', '正是 M1 规划器用的那组数。') },
        { tex: 'A = e^{A_c \\Delta t}, \\qquad B = \\int_0^{\\Delta t} e^{A_c s}\\, ds\\; B_c', why: t('The general recipe for any linear system $\\dot x = A_c x + B_c u$ with a held input. It is not an approximation: if the input really is held, the samples match the continuous system exactly (MathWorks, next page). In code: MATLAB’s `c2d`, or `scipy.signal.cont2discrete` (zero-order hold is its default).', '对任何线性系统 $\\dot x = A_c x + B_c u$，只要输入被保持，都按这个公式算。它不是近似：只要输入真的是被保持的，采样点上和连续系统分毫不差（MathWorks，见下一页）。代码里用 MATLAB 的 `c2d`，或者 `scipy.signal.cont2discrete`（默认就是零阶保持）。') },
      ],
      blank: { line: 1, answer: 'v_k + dt*a_k', variables: ['v_k', 'a_k', 'dt'], prompt: t('Speed one sample later, in $v_k$, $a_k$ and $\\Delta t$ (type `v_k`, `a_k`, `dt`).', '一个采样周期后的速度，用 $v_k$、$a_k$、$\\Delta t$ 表示（输入 `v_k`、`a_k`、`dt`）。') },
      outro: t('The shortcut many people write first, $p_{k+1} = p_k + \\Delta t\\, v_k$, is forward Euler. It looks harmless. The next page shows what it drops.', '很多人第一反应会写 $p_{k+1} = p_k + \\Delta t\\, v_k$，这是前向欧拉法。看着无伤大雅，下一页看它丢了什么。'),
    },
    {
      id: 'zoh', kind: 'read', title: t('Why not just Euler?', '为什么不直接用欧拉法？'),
      blocks: [
        { type: 'visual', name: 'mpc_zoh_step', caption: t('One sample: the held input makes $v$ a ramp, and the distance is the rectangle plus the triangle. Euler freezes the speed at its start value and keeps only the rectangle.', '一个采样周期：输入被保持，$v$ 是一段斜线，走过的距离是矩形加三角形。欧拉法把速度冻结在开头的值，只留下矩形。') },
        { type: 'p', text: t(
          'The triangle is small, $\\tfrac12 \\Delta t^2 a$ per step, but it is lost **every** step, always on the same side. From rest at 1 m/s² for 1 s the cart covers 0.5 m; Euler’s model says 0.45 m, 10% short. A planner that trusts Euler brakes at the wrong moment by exactly this kind of margin, and near a wall centimetres matter (a check at the end asks how many).',
          '三角形很小，每步只有 $\\tfrac12 \\Delta t^2 a$，可是**每一步**都丢，而且总是丢在同一边。从静止以 1 m/s² 加速 1 秒，小车走 0.5 米；欧拉模型说 0.45 米，少了 10%。信了欧拉模型的规划器，刹车时机就会差出这么一截；而在墙边，几厘米就是撞与不撞的区别（最后有一道题问到底差多少）。') },
        { type: 'p', text: t(
          '"Then make $\\Delta t$ tiny"? The controller’s $\\Delta t$ is not free: it is how often it can measure, solve and act (M5). The model has to be right **at that step**, and with a zero-order hold it is exact for free.',
          '"那把 $\\Delta t$ 取得很小不就行了？"控制器的 $\\Delta t$ 不是随便定的：它取决于多久能测一次、解一次、动一次（M5）。模型必须**在这个步长上**是对的，而零阶保持不花任何代价就做到了精确。') },
        { type: 'cite', key: 'mw', text: t('MathWorks. Continuous-Discrete Conversion Methods (Control System Toolbox documentation).', 'MathWorks。Continuous-Discrete Conversion Methods（Control System Toolbox 文档）。'), url: 'https://www.mathworks.com/help/control/ug/continuous-discrete-conversion-methods.html' },
      ],
    },
    // ---------------------------------------------------------------- 3. stack
    {
      id: 'stack', kind: 'derive', chapter: t('Predict a whole plan', '预测整个计划'), title: t('Unroll the model: X = Φx₀ + ΓU', '把模型展开：X = Φx₀ + ΓU'), skill: 'stack-predictions',
      intro: t('The planner needs all $N$ future states for a plan $U = (u_0, \\dots, u_{N-1})$. Apply the one-step model again and again and watch the pattern.', '规划器要的是一个计划 $U = (u_0, \\dots, u_{N-1})$ 下未来全部 $N$ 个状态。把一步模型一遍遍套下去，看看规律。'),
      lines: [
        { tex: 'x_1 = A x_0 + B u_0, \\qquad x_2 = A^2 x_0 + A B\\, u_0 + B\\, u_1', why: t('In $x_2$, the push $u_0$ has been carried one more step by $A$: a push keeps acting after it ends, through the speed it left behind.', '在 $x_2$ 里，推力 $u_0$ 又被 $A$ 带着走了一步：推力结束以后，它留下的速度还在继续起作用。') },
        { tex: 'x_k = A^k x_0 + \\sum_{j=0}^{k-1} A^{k-1-j} B\\, u_j', why: t('Two parts: $A^k x_0$, where the start leads on its own (the free response, all inputs zero), plus one term per input. The term $A^{k-1-j} B\\, u_j$ is $u_j$’s effect on $x_k$: its push $B$, carried for the $k-1-j$ steps that remain.', '两部分：$A^k x_0$ 是起点自己会把小车带到哪（自由响应，所有输入为零），再加上每个输入各一项。$A^{k-1-j} B\\, u_j$ 就是 $u_j$ 对 $x_k$ 的作用：它的那一推 $B$，再被带着走完剩下的 $k-1-j$ 步。') },
        { tex: '\\underbrace{\\begin{bmatrix} x_1 \\\\ x_2 \\\\ x_3 \\end{bmatrix}}_{X} = \\underbrace{\\begin{bmatrix} A \\\\ A^2 \\\\ A^3 \\end{bmatrix}}_{\\Phi} x_0 + \\underbrace{\\begin{bmatrix} B & 0 & 0 \\\\ AB & B & 0 \\\\ A^2 B & AB & B \\end{bmatrix}}_{\\Gamma} \\underbrace{\\begin{bmatrix} u_0 \\\\ u_1 \\\\ u_2 \\end{bmatrix}}_{U}', why: t('Stack them ($N = 3$ shown). $\\Phi$ says where the start leads, $\\Gamma$ how every input moves every state. The zeros above the diagonal are **causality**: $u_j$ cannot change a state before it is applied.', '把它们叠起来（这里 $N = 3$）。$\\Phi$ 说明起点会把小车带到哪，$\\Gamma$ 说明每个输入怎样移动每个状态。对角线上方全是零，这就是**因果性**：$u_j$ 改变不了它被施加之前的状态。') },
        { tex: '\\Gamma_{kj} = A^{k-1-j} B = \\begin{bmatrix} (k - j - \\tfrac12)\\, \\Delta t^2 \\\\ \\Delta t \\end{bmatrix} \\quad (j < k)', why: t('For the cart, $A^m = \\begin{bmatrix} 1 & m \\Delta t \\\\ 0 & 1 \\end{bmatrix}$. Speed: every input adds the same $\\Delta t$, however long ago. Position: an input adds more the earlier it came, because the extra speed has more steps to turn into distance.', '对小车来说 $A^m = \\begin{bmatrix} 1 & m \\Delta t \\\\ 0 & 1 \\end{bmatrix}$。速度：每个输入都加同样的 $\\Delta t$，不管多久以前。位置：输入来得越早，加得越多，因为多出来的速度有更多步可以变成距离。') },
        { tex: 'v_{10} = 0.5 + 0.1 \\sum_j u_j, \\qquad p_{10} = 10.2 + 0.01 \\sum_j (9.5 - j)\\, u_j', why: t('The last block row for the next world: $N = 10$, $\\Delta t = 0.1$, the cart at $p_0 = 9.7$ m coasting at $v_0 = 0.5$ m/s. Coasting alone ends at 10.2 m, 20 cm into a wall at 10 m.', '下一个世界用的最后一个块行：$N = 10$，$\\Delta t = 0.1$，小车在 $p_0 = 9.7$ 米处以 $v_0 = 0.5$ m/s 滑行。光靠滑行，最后会到 10.2 米，也就是冲进 10 米处的墙 20 厘米。') },
      ],
      blank: { line: 3, answer: '(k-j-1/2)*dt^2', variables: ['k', 'j', 'dt'], prompt: t('The position entry of $\\Gamma_{kj}$ for the cart, in $k$, $j$ and $\\Delta t$ (type `dt`).', '小车 $\\Gamma_{kj}$ 的位置分量，用 $k$、$j$、$\\Delta t$ 表示（输入 `dt`）。') },
      outro: t('So speed only counts **how much** you brake, while position also counts **when**. Make a guess before you see it.', '所以速度只看刹了**多少**，位置还要看**什么时候**刹。先猜一猜，再看。'),
    },
    {
      id: 'timing-predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'input-timing', purpose: 'predict',
      prompt: t('Plan A brakes at −1 m/s² on the first five bars ($u_0$ to $u_4$), plan B on the last five ($u_5$ to $u_9$). Same total braking. What is true at $k = 10$?', '计划 A 在前五根柱子（$u_0$ 到 $u_4$）上以 −1 m/s² 刹车，计划 B 在后五根（$u_5$ 到 $u_9$）上刹。刹车总量一样。$k = 10$ 时哪个说法对？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Same speed and same position', '速度一样，位置也一样'), misconception: 'timing-irrelevant' },
        { id: 'b', label: t('Same speed; B ends farther along', '速度一样；B 停得更远'), correct: true },
        { id: 'c', label: t('Same speed; A ends farther along', '速度一样；A 停得更远') },
        { id: 'd', label: t('B is still moving at $k = 10$', '$k = 10$ 时 B 还在动') },
      ] },
      explain: t('Both have $\\sum u_j = -5$, so $v_{10} = 0$ for both. But B coasts at full speed for half a second first: A stops at 9.825 m, B at 10.075 m, past the wall.', '两者都是 $\\sum u_j = -5$，所以 $v_{10}$ 都是 0。可是 B 先以全速滑行了半秒：A 停在 9.825 米，B 停在 10.075 米，穿过了墙。'),
      reveal: 'early-late',
      attempts: 1,
    },
    {
      id: 'early-late', kind: 'scene', title: t('Same total, different timing', '总量相同，时机不同'), scene: vis('mpc_bars', { story: 'early_late' }),
      narration: t(
        'Ten bars, ten planned accelerations, each held for a tenth of a second. Below them, the predicted speed and position. Dashed is coasting: the cart would end twenty centimetres inside the wall. Brake hard on the first five bars. The speed falls to zero, and the cart stops seventeen and a half centimetres short. Now move the same braking to the last five bars. The final speed is zero again, because speed only adds up the bars. But the cart first coasted at full speed for half a second, so it ends seven and a half centimetres past the wall. Same total, different timing, different position. The grey numbers under the bars say by how much.',
        '十根柱子，就是十个计划好的加速度，每个保持十分之一秒。下面是预测的速度和位置。虚线是一直滑行：小车最后会冲进墙里二十厘米。在前五根柱子上用力刹车。速度降到零，小车在离墙十七点五厘米的地方停下。现在把同样的刹车挪到后五根柱子。最后的速度还是零，因为速度只是把柱子加起来。可小车先全速滑行了半秒，所以最后停在墙后七点五厘米。总量相同，时机不同，位置就不同。柱子下面的灰色数字，说的就是差多少。'),
    },
    {
      id: 'dock-world', kind: 'explore', title: t('Plan the stop yourself', '自己规划这次停车'), skill: 'input-timing',
      scene: vis('mpc_bars', { plan: 'zero' }),
      prompt: t(
        'Drag the bars (each snaps to 0.1 m/s², at most 1 either way). (1) Make the cart **at rest** at $k = 10$. (2) Make it stop **at the wall**: within 1 cm of 10 m and never past it.',
        '拖动柱子（每根按 0.1 m/s² 吸附，正负都不超过 1）。（1）让小车在 $k = 10$ 时**停住**。（2）让它**停在墙边**：离 10 米不超过 1 厘米，而且从不穿墙。'),
      setup: attach('mpc_bars', { plan: 'zero' }),
      goals: [
        { id: 'at-rest', check: (s: any) => s.status().at_rest, message: t('At rest: the bars add up to −5, because $v_{10} = 0.5 + 0.1 \\sum u_j$. Any order works for this one.', '停住了：柱子加起来是 −5，因为 $v_{10} = 0.5 + 0.1 \\sum u_j$。这一条跟顺序无关。') },
        { id: 'docked', check: (s: any) => s.status().docked, message: t('Docked: on top of $\\sum u_j = -5$, the weighted sum $\\sum (9.5 - j)\\, u_j = -20$. Two equations, ten bars: the timing did the work.', '停靠成功：在 $\\sum u_j = -5$ 之外，还满足了加权和 $\\sum (9.5 - j)\\, u_j = -20$。两个方程，十根柱子：起作用的是时机。') },
      ],
      detectors: [
        { id: 'late', on: (e) => (e.type === 'bars' && e.data!.at_rest && (e.data!.past_k as number) > 0 ? { kind: 'misconception', id: 'timing-irrelevant', message: t('At rest, but past the wall: speed only counts the total, position also cares when you brake. Brake earlier.', '停住了，却穿过了墙：速度只看总量，位置还看什么时候刹。早一点刹。') } : null) },
        { id: 'early', on: (e) => (e.type === 'bars' && e.data!.at_rest && (e.data!.short_by as number) > 0.01 ? { kind: 'progress', id: 'too-early', message: t('At rest, but short of the wall: you braked too early. Move some braking to later bars.', '停住了，但离墙还远：刹得太早了。把一部分刹车挪到后面的柱子上。') } : null) },
        { id: 'reverse', on: (e) => (e.type === 'bars' && (e.data!.v_end as number) < -0.006 ? { kind: 'misconception', id: 'more-brake-safer', message: t('The bars add up to less than −5: the cart is now rolling backwards at $k = 10$. More braking is not safer, just wrong the other way.', '柱子加起来比 −5 还小：$k = 10$ 时小车在往回倒。多刹不是更保险，只是错到另一边去了。') } : null) },
      ],
      lines: [
        { text: t('Top: the ten planned accelerations. Middle: the speed they predict. Bottom: the position, and the wall.', '上面是十个计划好的加速度。中间是它们预测的速度。下面是位置，还有那堵墙。'), when: 'enter' },
        { text: t('Get the total right first, then think about the timing.', '先把总量弄对，再想时机。'), when: 'idle' },
        { text: t('Speed only counts the total. Position also cares when you brake.', '速度只看总量，位置还看什么时候刹。'), when: { finding: 'timing-irrelevant' } },
        { text: t('Braked too early. Coast a little longer first.', '刹得太早了。先多滑一会儿。'), when: { finding: 'too-early' } },
        { text: t('Now it rolls backwards. Take some braking away.', '现在它往回倒了。减掉一点刹车。'), when: { finding: 'more-brake-safer' } },
        { text: t('Docked. Every plan is just a point U, and the model turned it into a prediction with one matrix.', '停好了。每个计划只是一个点 U，模型用一个矩阵就把它变成了预测。'), when: 'goal' },
      ],
      hints: [
        t('For at rest: the ten bars must add up to −5, for example five bars at −1.', '要停住：十根柱子加起来必须是 −5，比如五根 −1。'),
        t('Early bars have big grey weights (9.5, 8.5, …), late ones small. Too short? Move braking to the right. Past the wall? Move it to the left.', '前面柱子的灰色权重大（9.5、8.5……），后面的小。停早了？把刹车往右挪。穿墙了？往左挪。'),
        t('One answer: coast for three bars, then −0.5, four bars of −1, −0.5, and a last bar of 0.', '一个答案：先滑行三根，然后 −0.5、四根 −1、−0.5，最后一根 0。'),
      ],
      cue: [t(bar_label(0, en_label), bar_label(0, zh_label))],
      solve: (s: any, _c, w) => {
        s.set_plan(mpc_bars_math.DOCK_PLAN);
        w.emit('bars', s.report(0));
      },
    },
    {
      id: 'takeaway', kind: 'read', title: t('What the world showed', '这个世界说明了什么'),
      blocks: [
        { type: 'p', text: t('The two numbers you were steering are the last block row of $\\Gamma$:', '你刚才在调的两个数，就是 $\\Gamma$ 的最后一个块行：') },
        { type: 'list', items: [
          t('**Speed** gives every bar the same weight $\\Delta t$: only the total counts, $\\sum u_j = -5$ to stop.', '**速度**给每根柱子同样的权重 $\\Delta t$：只看总量，要停住就得 $\\sum u_j = -5$。'),
          t('**Position** weights bar $j$ by $(9.5 - j)\\,\\Delta t^2$: braking early takes off more distance than braking late.', '**位置**给第 $j$ 根柱子的权重是 $(9.5 - j)\\,\\Delta t^2$：早刹比晚刹减掉更多距离。'),
        ] },
        { type: 'p', text: t(
          'There is a neat way to read the two together. Once the cart stops, the distance it covered is its starting speed times the **mean time of the braking**, $t_c$, the average of the bars’ mid-times weighted by how hard each brakes:',
          '把两条放在一起，有个很漂亮的读法。只要小车最后停住，它走过的距离就等于初速度乘以**刹车的平均时刻** $t_c$，也就是按每根柱子刹多狠加权，对柱子的中点时刻求平均：') },
        { type: 'math', tex: 'p_N - p_0 = v_0\\, t_c, \\qquad t_c = \\frac{\\sum_j (j + \\tfrac12)\\Delta t\\; u_j}{\\sum_j u_j} ' },
        { type: 'p', text: t(
          'As if all the braking happened in one instant at $t_c$: until then the cart keeps its 0.5 m/s. Early plan: $t_c = 0.25$ s, 12.5 cm. Late plan: $t_c = 0.75$ s, 37.5 cm. Docking needs 30 cm, so $t_c = 0.6$ s.',
          '就好像所有刹车都集中在 $t_c$ 这一瞬间：在那之前，小车一直保持 0.5 m/s。早刹的计划 $t_c = 0.25$ 秒，走 12.5 厘米；晚刹的 $t_c = 0.75$ 秒，走 37.5 厘米。停靠要走 30 厘米，所以 $t_c = 0.6$ 秒。') },
        { type: 'callout', kind: 'note', title: t('Many plans dock', '能停靠的计划有很多'), body: t(
          'Ten bars, two equations: there are many docking plans. Which one is **best** (gentle? fast?) is not a question the model can answer. That is the cost, M3. And keeping $|a| \\le 1$ and $p \\le 10$ automatically is the constraints, M4.',
          '十根柱子，两个方程：能停靠的计划有很多。哪一个**最好**（最平顺？最快？），模型回答不了，那是代价函数的事，M3 讲。至于自动守住 $|a| \\le 1$ 和 $p \\le 10$，那是约束，M4 讲。') },
      ],
    },
    {
      id: 'code', kind: 'code', title: t('Φ and Γ in twenty lines', '二十行代码算出 Φ 和 Γ'),
      intro: t('The whole lesson in NumPy: discretize, stack, predict the docking plan, and check against a step-by-step simulation.', '用 NumPy 把整节课走一遍：离散化、叠起来、预测那个停靠计划，再和一步一步的模拟对一下。'),
      lang: 'python', code: PREDICT_CODE,
      notes: [
        { lines: [5, 6], text: t('The continuous model $\\dot x = A_c x + B_c a$.', '连续时间模型 $\\dot x = A_c x + B_c a$。') },
        { lines: [7, 10], text: t('Exact zero-order hold with one matrix exponential: the top-right block of $e^{M \\Delta t}$ is $B$. `scipy.signal.cont2discrete` does the same.', '用一次矩阵指数做精确的零阶保持：$e^{M \\Delta t}$ 右上角那块就是 $B$。`scipy.signal.cont2discrete` 做的是同一件事。'), shapes: 'A: [2, 2]  B: [2, 1]' },
        { lines: [12, 17], text: t('$\\Phi$ stacks $A, A^2, \\dots$; $\\Gamma$ fills only the blocks with $j < k$: lower triangular, by causality.', '$\\Phi$ 把 $A, A^2, \\dots$ 叠起来；$\\Gamma$ 只填 $j < k$ 的块：因为因果性，它是下三角的。'), shapes: 'Phi: [2N, 2]  Gamma: [2N, N]' },
        { lines: [19, 22], text: t('One matrix–vector product predicts all ten states of the plan. The last two numbers are $p_{10} = 10$ and $v_{10} = 0$: docked.', '一次矩阵乘向量，就预测出计划的全部十个状态。最后两个数是 $p_{10} = 10$、$v_{10} = 0$：停靠成功。'), shapes: 'X: [2N]' },
        { lines: [24, 27], text: t('The same answer from simulating step by step: $\\Phi$ and $\\Gamma$ are just the simulation, written once as a matrix.', '一步一步模拟，得到同样的答案：$\\Phi$ 和 $\\Gamma$ 就是这段模拟，一次性写成了矩阵。') },
      ],
    },
    // ---------------------------------------------------------------- 4. linear
    {
      id: 'linear', kind: 'read', chapter: t('Why linear matters', '线性为什么要紧'), title: t('The key fact: predictions are linear in the plan', '关键事实：预测对计划是线性的'),
      blocks: [
        { type: 'math', tex: 'X = \\Phi\\, x_0 + \\Gamma\\, U' },
        { type: 'p', text: t('$x_0$ is measured, so it is a fixed number at solve time. What the optimizer chooses is $U$, and $X$ depends on it through one fixed matrix. That shape carries through the whole problem[^bemp]:', '$x_0$ 是测出来的，求解时它是一个固定的数。优化器要选的是 $U$，而 $X$ 对 $U$ 的依赖，就是乘上一个固定的矩阵。这个形状会一路贯穿整个问题[^bemp]：') },
        { type: 'list', items: [
          t('**A quadratic cost stays quadratic in $U$.** Substitute $X$ into $\\sum x^\\top Q x + u^\\top R u$ and you get $\\tfrac12 U^\\top H U + (F x_0)^\\top U$ + const: a bowl, whose bottom is one linear solve (M3).', '**二次代价对 $U$ 仍是二次的。**把 $X$ 代进 $\\sum x^\\top Q x + u^\\top R u$，得到 $\\tfrac12 U^\\top H U + (F x_0)^\\top U$ + 常数：一个碗，碗底一次线性方程组就能解出来（M3）。'),
          t('**Linear limits stay linear in $U$.** The wall $p_k \\le 10$ for every $k$ is a set of rows of $\\Phi x_0 + \\Gamma U \\le 10$, so all the limits together read $G U \\le w + E x_0$ (M4).', '**线性的限制对 $U$ 仍是线性的。**对每个 $k$ 都要 $p_k \\le 10$，就是 $\\Phi x_0 + \\Gamma U \\le 10$ 里的若干行；所有限制放在一起，就是 $G U \\le w + E x_0$（M4）。'),
          t('A bowl with flat walls is a **quadratic program** (QP): convex, one global optimum, and solvers that finish reliably in milliseconds (M5).', '一个碗加上一些平的墙，就是**二次规划**（QP）：凸的，只有一个全局最优，求解器能在毫秒级稳定地解完（M5）。'),
        ] },
        { type: 'p', text: t(
          '"Why not simulate a detailed nonlinear model instead?" You can, and M8 does. But then the cost is no longer a bowl: there can be several valleys, and no guarantee how long the solver takes. That is why nonlinear MPC is used less and on smaller problems[^qin], and why engineers often simplify a model on purpose to keep the problem a QP: MIT’s Cheetah 3 robot simplifies its body dynamics so that every step is a QP, solved in under 1 ms[^cheetah]. For our cart nothing is lost: the linear model is exact.',
          '"为什么不直接模拟一个细致的非线性模型？"可以，M8 就这么做。可那样代价就不再是一个碗了：可能有好几个山谷，求解要多久也没有保证。所以非线性 MPC 用得更少、问题规模也更小[^qin]；工程师也常常有意简化模型，好让问题保持为 QP：MIT 的 Cheetah 3 机器人就简化了身体的动力学，让每一步都是一个 QP，1 毫秒内解完[^cheetah]。对我们的小车来说什么也没丢：线性模型本来就是精确的。') },
        { type: 'p', text: t(
          'Where do $A$ and $B$ come from on real machines? From physics, as here, or fitted to measured data (system identification). GM’s production engine MPC, for example, uses linear models identified from data[^gm].',
          '真实机器上的 $A$ 和 $B$ 从哪来？要么像这里一样从物理推出来，要么用测量数据拟合（系统辨识）。比如通用汽车量产发动机上的 MPC，用的就是从数据辨识出来的线性模型[^gm]。') },
        { type: 'details', summary: t('Keep the states as unknowns instead?', '也可以把状态留作未知数？'), blocks: [
          { type: 'p', text: t(
            'Substituting $X = \\Phi x_0 + \\Gamma U$ is called **condensing**: the only unknowns are the $N$ inputs, but $\\Gamma$ is dense. The alternative keeps every $x_k$ as an unknown and imposes $x_{k+1} = A x_k + B u_k$ as equality constraints: more unknowns, but sparse. Both describe the same QP; which one is faster depends on $N$ and the solver (M5).',
            '把 $X = \\Phi x_0 + \\Gamma U$ 代进去，叫作**压缩**（condensing）：未知数只剩 $N$ 个输入，但 $\\Gamma$ 是稠密的。另一种做法是把每个 $x_k$ 都留作未知数，把 $x_{k+1} = A x_k + B u_k$ 当作等式约束：未知数更多，但矩阵是稀疏的。两种写法描述的是同一个 QP；哪个更快，取决于 $N$ 和求解器（M5）。') },
        ] },
        { type: 'cite', key: 'bemp', text: t('Bemporad, A. Model Predictive Control, course slides, part 1: linear MPC (prediction and condensing, slides 36–37).', 'Bemporad, A. Model Predictive Control 课程讲义，第 1 部分：线性 MPC（预测与压缩，第 36–37 页）。'), url: 'https://cse.lab.imtlucca.it/~bemporad/teaching/mpc/imt/1-linear_mpc.pdf' },
        { type: 'cite', key: 'qin', text: t('Qin, S. J. & Badgwell, T. A. (2003). A survey of industrial model predictive control technology. Control Engineering Practice 11(7).', 'Qin, S. J. & Badgwell, T. A.（2003）。A survey of industrial model predictive control technology。Control Engineering Practice 11(7)。'), url: 'https://doi.org/10.1016/S0967-0661(02)00186-7' },
        { type: 'cite', key: 'cheetah', text: t('Di Carlo et al. (2018). Dynamic Locomotion in the MIT Cheetah 3 Through Convex Model-Predictive Control. IROS.', 'Di Carlo 等（2018）。Dynamic Locomotion in the MIT Cheetah 3 Through Convex Model-Predictive Control。IROS。'), url: 'https://doi.org/10.1109/IROS.2018.8594448' },
        { type: 'cite', key: 'gm', text: t('Bemporad, Bernardini, Long & Verdejo (2018). Model Predictive Control of Turbocharged Gasoline Engines for Mass Production. SAE 2018-01-0875.', 'Bemporad、Bernardini、Long、Verdejo（2018）。Model Predictive Control of Turbocharged Gasoline Engines for Mass Production。SAE 2018-01-0875。'), url: 'https://doi.org/10.4271/2018-01-0875' },
      ],
    },
    // ---------------------------------------------------------------- checks
    {
      id: 'q-speed', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('Read off the speed', '读出速度'), skill: 'stack-predictions', purpose: 'check',
      prompt: t('Same cart and start ($v_0 = 0.5$ m/s, $\\Delta t = 0.1$ s). The plan brakes at −1 on $u_0$ to $u_3$, coasts, and pushes +0.5 on the last bar $u_9$. What is $v_{10}$?', '同样的小车和起点（$v_0 = 0.5$ m/s，$\\Delta t = 0.1$ 秒）。计划在 $u_0$ 到 $u_3$ 上以 −1 刹车，然后滑行，最后一根柱子 $u_9$ 上推 +0.5。$v_{10}$ 是多少？'),
      question: { type: 'number', answer: 0.15, tolerance: 0.005, unit: t('m/s', 'm/s'), wrong: [
        { answer: 0.1, feedback: t('That leaves out the last push: it still adds $0.1 \\times 0.5$ to the speed, even though it comes last.', '这样漏掉了最后那一推：它虽然排在最后，照样给速度加了 $0.1 \\times 0.5$。'), misconception: 'timing-irrelevant' },
        { answer: -3, feedback: t('That is $\\sum u_j + 0.5$. Each bar changes the speed by $\\Delta t \\cdot u_j$, not $u_j$.', '这是 $\\sum u_j + 0.5$。每根柱子让速度变化 $\\Delta t \\cdot u_j$，不是 $u_j$。') },
      ] },
      explain: t('$v_{10} = 0.5 + 0.1\\,(-4 + 0.5) = 0.15$ m/s. Every bar counts the same for speed, wherever it sits.', '$v_{10} = 0.5 + 0.1\\,(-4 + 0.5) = 0.15$ m/s。对速度来说，每根柱子的分量都一样，不管它排在哪。'),
    },
    {
      id: 'q-euler', kind: 'checkpoint', title: t('Planned with Euler', '用欧拉模型规划'), skill: 'discretize', purpose: 'check',
      prompt: t('Someone plans the docking with Euler’s model ($p_{k+1} = p_k + \\Delta t\\, v_k$). Their plan, −1 on $u_3$ to $u_7$, docks exactly at 10.000 m **in their model**. The real cart holds each input for the step. How many centimetres short of the wall does it really stop?', '有人用欧拉模型（$p_{k+1} = p_k + \\Delta t\\, v_k$）规划停靠。他的计划是在 $u_3$ 到 $u_7$ 上刹 −1，**在他的模型里**恰好停在 10.000 米。真实的小车每一步都保持输入。它实际离墙还差几厘米就停了？'),
      question: { type: 'number', answer: 2.5, tolerance: 0.15, unit: t('cm', '厘米'), wrong: [
        { answer: 0, feedback: t('Euler drops $\\tfrac12 \\Delta t^2 u_k$ every step. Here the braking steps add up to $\\sum u = -5$, so the two models disagree.', '欧拉法每一步都丢掉 $\\tfrac12 \\Delta t^2 u_k$。这里刹车各步加起来 $\\sum u = -5$，所以两个模型的结论不一样。'), misconception: 'euler-good-enough' },
        { answer: 0.5, feedback: t('That is one step’s triangle. It is lost on each of the five braking steps.', '这只是一步的三角形。五个刹车步每一步都丢一个。') },
      ] },
      explain: t('The real position differs by $\\tfrac12 \\Delta t^2 \\sum u_k = 0.005 \\times (-5) = -0.025$ m: braking acts within its own step, so the real cart stops at 9.975 m, 2.5 cm short.', '真实位置差了 $\\tfrac12 \\Delta t^2 \\sum u_k = 0.005 \\times (-5) = -0.025$ 米：刹车在它自己那一步里就已经起作用了，所以真实的小车停在 9.975 米，差 2.5 厘米。'),
    },
    {
      id: 'q-causal', kind: 'checkpoint', title: t('A suspicious Γ', '可疑的 Γ'), skill: 'stack-predictions', purpose: 'check',
      prompt: t('A colleague’s code builds a $\\Gamma$ whose block in row $k = 2$, column $j = 3$ is nonzero. What does that say?', '同事的代码算出的 $\\Gamma$，第 $k = 2$ 行、第 $j = 3$ 列的块不是零。这说明什么？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('A bug: the prediction of $x_2$ would depend on $u_3$, an input applied later', '有 bug：$x_2$ 的预测会依赖 $u_3$，一个更晚才施加的输入'), correct: true },
        { id: 'b', label: t('Fine: the planner knows $u_3$ in advance, so it may use it', '没问题：规划器事先就知道 $u_3$，可以用'), misconception: 'future-input-acts' },
        { id: 'c', label: t('Fine if $A$ is unstable', '如果 $A$ 不稳定就没问题') },
        { id: 'd', label: t('It means the model has a delay', '说明模型有时延') },
      ] },
      explain: t('Block $(k, j)$ is $u_j$’s effect on $x_k$, and $u_j$ only acts from step $j$ onward. Knowing a future input is not the same as it having already acted. Every block with $j \\ge k$ must be zero; check the index offset (rows are $x_1 \\dots x_N$, columns $u_0 \\dots u_{N-1}$).', '块 $(k, j)$ 是 $u_j$ 对 $x_k$ 的影响，而 $u_j$ 从第 $j$ 步才开始起作用。事先知道一个未来的输入，不等于它已经起了作用。所有 $j \\ge k$ 的块都必须是零；去查一下下标的偏移（行是 $x_1 \\dots x_N$，列是 $u_0 \\dots u_{N-1}$）。'),
    },
    {
      id: 'q-linear', kind: 'checkpoint', title: t('Explain it', '解释一下'), skill: 'linear-qp', purpose: 'check',
      prompt: t('A teammate says: "$X = \\Phi x_0 + \\Gamma U$ is nice, but it is just a faster way to simulate." Explain in two or three sentences what else it buys MPC.', '队友说："$X = \\Phi x_0 + \\Gamma U$ 挺好，但它不过是一种更快的模拟方法。"用两三句话解释它还给 MPC 带来了什么。'),
      question: { type: 'text', placeholder: t('Because X is linear in U, …', '因为 X 对 U 是线性的，……'), rubric: {
        key_points: [
          t('Substituted into a quadratic cost, it gives a cost that is quadratic (a convex bowl) in U.', '代进二次代价后，代价对 U 是二次的（一个凸的碗）。'),
          t('Linear limits on states and inputs become linear inequalities in U.', '对状态和输入的线性限制，变成对 U 的线性不等式。'),
          t('So each MPC step is a convex QP: one global optimum, solved reliably and fast; a nonlinear model would make it nonconvex.', '所以 MPC 每一步都是一个凸 QP：只有一个全局最优，能又快又稳地解出来；换成非线性模型，问题就不凸了。'),
        ],
        model_answer: t('Because $X$ is linear in $U$, a quadratic cost becomes a quadratic bowl in $U$, and linear limits such as $p_k \\le 10$ or $|a_k| \\le 1$ become linear inequalities $GU \\le w + Ex_0$. Together that is a convex QP, with one global optimum that solvers find reliably in milliseconds. With a nonlinear model the problem would be nonconvex: local minima and no guarantee on solve time.', '因为 $X$ 对 $U$ 是线性的，二次代价就成了 $U$ 的一个二次碗，而像 $p_k \\le 10$、$|a_k| \\le 1$ 这样的线性限制就成了线性不等式 $GU \\le w + Ex_0$。合在一起就是一个凸 QP：只有一个全局最优，求解器能在毫秒级稳定地找到。换成非线性模型，问题就不凸了：会有局部极小，求解时间也没有保证。'),
        min_points: 2,
      } },
    },
  ],
};
