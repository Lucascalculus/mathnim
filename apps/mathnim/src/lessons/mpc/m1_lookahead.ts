// M1 Look ahead, then act: why a controller that only reacts to the error
// cannot respect limits it does not know about, what MPC does instead (predict
// with a model, choose N inputs within the limits, apply the first, re-plan),
// and how far ahead it must look. Plan: docs/lessons/mpc/README.md (M1);
// design and numbers: checkpoints/m1.md; sources: research-m1.md. Every number
// about the cart is a simulation of the course's toy model (dock.test.ts).
import type { Lesson } from '@mathnim/core';
import { DOCK_LABELS } from '@mathnim/visuals/mpc';
import { attach, t, vis } from './common';

const LOOP_CODE = `import numpy as np
import cvxpy as cp

dt, N = 0.1, 20                            # 20 steps of 0.1 s: look 2 s ahead
A = np.array([[1, dt], [0, 1]])            # the model: x = (p, v)
B = np.array([[dt**2 / 2], [dt]])
a_max, v_max, wall = 1.0, 2.0, 10.0

def plan(x0):
    X = cp.Variable((2, N + 1))            # predicted states x_0 .. x_N
    U = cp.Variable((1, N))                # planned accelerations a_0 .. a_{N-1}
    cost = cp.sum_squares(X[0, :] - wall) + 0.1 * cp.sum_squares(U)
    limits = [X[:, 0] == x0,                         # start from the measurement
              X[:, 1:] == A @ X[:, :-1] + B @ U,     # the model, N times
              cp.abs(U) <= a_max,                    # brakes and engine
              cp.abs(X[1, 1:]) <= v_max,             # speed limit
              X[0, 1:] <= wall]                      # never past the wall
    cp.Problem(cp.Minimize(cost), limits).solve()
    if U.value is None:                    # no plan keeps it off the wall:
        return -a_max                      # brake as hard as it can
    return U.value[0, 0]                   # keep only the first step

x = np.array([0.0, 0.0])                   # at rest, 10 m from the wall
for k in range(100):                       # 10 s, one decision every 0.1 s
    a = plan(x)                            # 1. plan N steps from where it is
    x = A @ x + B[:, 0] * a                # 2. apply the first; the cart moves
                                           # 3. next time round, x is measured again`;

/** The world's last released setting (the visual's 'released' event: {N, a, crashed, impact, docked_t}). */
type Released = { N: number; a: number; crashed: boolean; impact: number; docked_t: number };
const last = (w: { state: Record<string, unknown> }) => w.state.last as Released | undefined;

export const lesson: Lesson = {
  id: 'mpc-m1-lookahead',
  title: t('Look ahead, then act', '往前看再动手'),
  description: t(
    'Why a controller that only reacts to the error cannot respect limits it does not know about, what model predictive control does instead, and how far ahead it has to look.',
    '只对误差做出反应的控制器，为什么守不住它不知道的限制；模型预测控制换了什么做法；它要往前看多远。'),
  mode: 'essay',
  skills: [
    { id: 'mpc-loop', name: t('The MPC loop: predict, optimise, apply the first, repeat', 'MPC 的循环：预测、优化、执行第一步、重来') },
    { id: 'first-step', name: t('Why only the first step is applied', '为什么只执行第一步'), prerequisites: ['mpc-loop'] },
    { id: 'horizon-length', name: t('How far ahead the plan must look', '计划要往前看多远'), prerequisites: ['mpc-loop'] },
    { id: 'mpc-vs-pid', name: t('When MPC is worth it over PID', '什么时候值得用 MPC 而不是 PID') },
  ],
  misconceptions: [
    { id: 'pid-tune-fixes', description: t('Any limit can be handled by tuning the PID gains well enough.', '只要 PID 参数调得够好，什么限制都能应付。') },
    { id: 'replan-fixes-short-horizon', description: t('Re-planning often makes up for a short look-ahead.', '只要重新规划得够勤，看得近一点也没关系。') },
    { id: 'horizon-fixed-number', description: t('There is one good horizon length, whatever the system.', '预测时域有一个"标准"长度，跟系统无关。') },
    { id: 'longer-is-free', description: t('A longer horizon is always better and costs nothing.', '预测时域越长越好，而且没有代价。') },
    { id: 'plan-once', description: t('A good plan can be made once and then executed.', '好的计划做一次，照着执行就行。') },
    { id: 'apply-first-saves-compute', description: t('MPC applies only the first step to save computation.', 'MPC 只执行第一步，是为了省计算量。') },
    { id: 'plan-sees-everything', description: t('If the plan satisfies its constraints, the real run will too.', '只要计划满足约束，实际运行也一定满足。') },
    { id: 'mpc-always-better', description: t('MPC is better than PID everywhere.', 'MPC 在哪儿都比 PID 好。') },
  ],
  steps: [
    // ------------------------------------------------------------------ the problem
    {
      id: 'react', kind: 'read', chapter: t('The problem', '问题'), title: t('A controller that only looks at the error', '只盯着误差的控制器'),
      blocks: [
        { type: 'p', text: t(
          'A cart stands at rest on a track, 10 m from a wall. It must end up touching the wall, at rest, without hitting it. Its motor can speed it up or slow it down by at most 1 m/s², and it must never go faster than 2 m/s. This toy cart is the course’s running example; every number about it in this course comes from a simulation.',
          '一辆小车静止停在轨道上，离墙 10 米。它要开过去贴着墙停住，不能撞上。电机给它的加速度和减速度都不能超过 1 m/s²（也就是每秒最多改变 1 m/s 的速度），车速也不能超过 2 m/s。这辆玩具小车会贯穿整门课；课里所有关于它的数字都来自模拟。') },
        { type: 'p', text: t(
          'The textbook answer is PID control: set the acceleration from the error now ($10 - p$), its past (the integral) and its trend (the derivative). Below is its PD form, $a = k_p(10 - p) - k_d v$, with three choices of gains:',
          '教科书里的标准答案是 PID 控制：根据此刻的误差（$10 - p$）、误差的累积（积分）和误差的变化趋势（微分）来定加速度。下面是它的 PD 形式 $a = k_p(10 - p) - k_d v$，三组不同的参数：') },
        { type: 'visual', name: 'mpc_pd_compare', params: {}, caption: t(
          'Aggressive gains hit the wall; cautious ones are still 15 cm short after 10 s; gains found by trial and error dock at 8.6 s.',
          '参数激进就撞墙；参数保守，10 秒后还差 15 cm；反复试出来的一组参数在 8.6 秒停稳。') },
        { type: 'p', text: t(
          'Look at what the law contains: the error and the speed. Nothing in it says "the brakes are limited to 1 m/s²" or "the wall is 2 m away and braking from 2 m/s takes 2 m". The tuned gains work only because someone tried them against these brakes. Now make the brakes half as strong:',
          '看看这条控制律里有什么：误差和速度。里面没有任何一项在说"刹车最多 1 m/s²"，也没有一项在说"离墙还有 2 米，而从 2 m/s 刹停正好要 2 米"。调好的那组参数之所以管用，只是因为有人拿这副刹车反复试过。现在把刹车减弱一半：') },
        { type: 'visual', name: 'mpc_pd_compare', params: { brakes: '0.5', show_mpc: true }, caption: t(
          'The same tuned PD hits the wall at 1.33 m/s. A controller that is told the brakes and looks 4 s ahead (blue) docks at 9.0 s.',
          '同一组调好的 PD 以 1.33 m/s 撞墙。另一个控制器被告知刹车有多强，并且往前看 4 秒（蓝线），9.0 秒时停稳。') },
        { type: 'p', text: t(
          'You could retune the PID for the weaker brakes, and again for every new load, slope or speed limit. The blue controller needed no retuning: it was told the new brake limit and planned with it. That controller is model predictive control (MPC).',
          '当然可以为弱刹车重新调一遍 PID，而且每换一种负载、坡度或限速都得再调一遍。蓝线那个控制器不用重调：只要告诉它新的刹车上限，它就带着这个上限去做计划。这就是模型预测控制（MPC）。') },
      ],
    },
    {
      id: 'idea', kind: 'read', title: t('MPC in one sentence', '一句话说清 MPC'),
      blocks: [
        { type: 'p', text: t(
          'MPC uses a model to predict what the next few seconds would look like for each possible sequence of inputs, picks the best sequence that respects every limit, applies **only its first step**, measures where it really is, and does it all again[^rmd].',
          'MPC 用一个模型预测：如果接下来按某一串输入去做，未来几秒会是什么样；从中挑出遵守所有限制的最好的那一串，**只执行其中第一步**，再测一测自己实际到了哪儿，然后从头再来一遍[^rmd]。') },
        { type: 'p', text: t('It needs three ingredients:', '它需要三样东西：') },
        { type: 'list', items: [
          t('**a model** that predicts the next state from the current one and the input (M2);', '**模型**：由当前状态和输入，预测下一时刻的状态（M2）；'),
          t('**a cost** that scores a predicted future: how far from the goal, how much effort (M3);', '**代价**：给一段预测的未来打分：离目标多远、用了多大的力（M3）；'),
          t('**constraints**, the limits written down: brakes, speed, the wall (M4). They are what sets MPC apart from classical optimal control[^rmd2].', '**约束**：把限制写下来：刹车、限速、墙（M4）。正是约束让 MPC 区别于经典的最优控制[^rmd2]。'),
        ] },
        { type: 'table', head: [t('What', '对比项'), t('PID', 'PID'), t('MPC', 'MPC')], rows: [
          [t('looks at', '看的是'), t('the error now, its past and its trend', '此刻的误差、它的累积和趋势'), t('a predicted future, N steps ahead', '预测出来的未来，往前 N 步')],
          [t('limits', '限制'), t('not in the law; clip the output and hope', '不在控制律里；只能把输出截断，听天由命'), t('part of the problem it solves', '就是它所解问题的一部分')],
          [t('needs', '需要'), t('gains, tuned on the plant', '在实物上调出来的参数'), t('a model, a cost, the limits', '模型、代价、限制')],
          [t('work per step', '每步计算'), t('a few multiplications', '几次乘法'), t('an optimisation problem', '一个优化问题')],
        ] },
        { type: 'p', text: t('Watch the loop on the cart.', '下面在小车上看看这个循环。') },
        { type: 'cite', key: 'rmd', text: t('Rawlings, Mayne & Diehl (2017/2026). Model Predictive Control: Theory, Computation, and Design, 2nd ed., §1.2 p. 1 and §2.2 p. 99.', 'Rawlings、Mayne 与 Diehl（2017/2026）。Model Predictive Control: Theory, Computation, and Design，第 2 版，§1.2 第 1 页、§2.2 第 99 页。'), url: 'https://sites.engineering.ucsb.edu/~jbraw/mpc/' },
        { type: 'cite', key: 'rmd2', text: t('Rawlings, Mayne & Diehl, §1.3.1 p. 11: "The constraints are the main feature that distinguishes MPC from the standard linear quadratic (LQ) control."', 'Rawlings、Mayne 与 Diehl，§1.3.1 第 11 页："The constraints are the main feature that distinguishes MPC from the standard linear quadratic (LQ) control."'), url: 'https://sites.engineering.ucsb.edu/~jbraw/mpc/' },
      ],
    },
    {
      id: 'loop', kind: 'scene', title: t('Plan, apply the first, re-plan', '做计划，走一步，再做计划'), scene: vis('mpc_receding_loop', { N: 20 }),
      narration: t(
        'At every instant the controller plans twenty steps, two seconds ahead: § the dashed curve is where it predicts the cart will be, the strip below holds the twenty accelerations it chose. § It applies only the first one. The cart moves a tenth of a second, the window slides forward by one step, and it plans again from where the cart really is. § Watch the strip: the braking first appears at the far end of the window, the moment the stop fits inside it, § and then moves closer, step by step, until it is the step being applied.',
        '每一个时刻，控制器都往前规划二十步，也就是两秒：§虚线是它预测小车会到的位置，下面这一条格子是它选出的二十个加速度。§它只执行第一个。小车走了十分之一秒，窗口往前滑一步，它再从小车实际所在的位置重新规划。§盯着这条格子看：刹车最先出现在窗口的最远端，就在整段刹停刚好装进窗口的那一刻；§然后一步一步往前挪，直到变成正在执行的那一步。'),
    },
    // ------------------------------------------------------------------ the optimisation
    {
      id: 'problem', kind: 'read', chapter: t('The problem it solves', '它解的是什么问题'), title: t('One plan, written as an optimisation', '把一次规划写成优化问题'),
      blocks: [
        { type: 'p', text: t(
          'Each dashed curve in the scene is the answer to one optimisation problem. The state is $x_k = (p_k, v_k)$, position and speed after $k$ steps of 0.1 s; the input $u_k = a_k$ is the acceleration held during that step. Starting from the measured state, the controller chooses $a_0, \\dots, a_{N-1}$ to',
          '场景里的每一条虚线，都是一个优化问题的解。状态 $x_k = (p_k, v_k)$ 是走了 $k$ 步（每步 0.1 秒）之后的位置和速度；输入 $u_k = a_k$ 是这一步里保持不变的加速度。从测得的状态出发，控制器选择 $a_0, \\dots, a_{N-1}$，使得') },
        { type: 'math', tex: '\\min_{a_0,\\dots,a_{N-1}} \\; \\sum_{k=0}^{N} (p_k - 10)^2 \\;+\\; 0.1 \\sum_{k=0}^{N-1} a_k^2' },
        { type: 'math', tex: '\\text{s.t.}\\quad x_{k+1} = \\begin{bmatrix} 1 & 0.1 \\\\ 0 & 1 \\end{bmatrix} x_k + \\begin{bmatrix} 0.005 \\\\ 0.1 \\end{bmatrix} a_k, \\quad |a_k| \\le 1, \\quad |v_k| \\le 2, \\quad p_k \\le 10, \\quad x_0 = x(t)' },
        { type: 'list', items: [
          t('$(p_k - 10)^2$ pulls every predicted position towards the wall: the sooner it gets there, the smaller the sum.', '$(p_k - 10)^2$ 把每一个预测位置都往墙边拉：越早到，这一项加起来越小。'),
          t('$0.1\\, a_k^2$ charges for effort, so it does not slam between full throttle and full brakes for nothing.', '$0.1\\, a_k^2$ 为用力收费，免得它毫无必要地在油门踩到底和刹车踩到底之间来回切换。'),
          t('The model links the inputs to the predicted states: position grows by speed × 0.1 s (plus half an acceleration step), speed by acceleration × 0.1 s. Where these numbers come from is M2.', '模型把输入和预测状态连起来：位置每步增加"速度 × 0.1 秒"（再加半步加速度的贡献），速度每步增加"加速度 × 0.1 秒"。这些数从哪来，M2 讲。'),
          t('The limits are written straight into the problem. A plan that breaks one is not a candidate at all, rather than a candidate that pays a penalty.', '限制直接写进问题里。违反限制的计划根本不在候选之列，而不是"违反了就罚点分"。'),
          t('$x_0 = x(t)$ is the state **measured** now: this is where feedback enters.', '$x_0 = x(t)$ 是此刻**测得的**状态：反馈就是从这里进来的。'),
        ] },
        { type: 'p', text: t(
          'With a quadratic cost, a linear model and linear limits, this is a quadratic program, a problem solvers handle in milliseconds. M3 explains the cost and its weights, M4 the limits and the shape of the solution, M5 how to solve it fast enough.',
          '代价是二次的，模型是线性的，限制也是线性的，所以这是一个二次规划（QP），求解器几毫秒就能解完。代价和权重在 M3 讲，限制和解的形状在 M4 讲，怎样解得足够快在 M5 讲。') },
      ],
    },
    {
      id: 'loop-code', kind: 'code', title: t('The whole loop in code', '整个循环写成代码'),
      intro: t('The same problem with cvxpy, inside the loop that makes it a controller.', '用 cvxpy 写出同一个问题，再放进让它成为控制器的那个循环里。'),
      lang: 'python', code: LOOP_CODE,
      notes: [
        { lines: [4, 7], text: t('The model and the limits: the only things the controller is told about the cart.', '模型和限制：关于这辆车，控制器知道的就只有这些。') },
        { lines: [10, 12], text: t('The unknowns are the N accelerations (the states follow from them); the cost is the sum on the page.', '未知量是 N 个加速度（状态由它们决定）；代价就是上一页那个求和。'), shapes: 'X: [2, N+1]  U: [1, N]' },
        { lines: [13, 17], text: t('Each line of the constraints is one line of the problem on the previous page. The first ties the plan to the measurement.', '约束的每一行，对应上一页问题里的一行。第一行把计划钉在测量值上。') },
        { lines: [19, 20], text: t('When no plan can keep the cart off the wall, the problem is infeasible; this controller then brakes fully (M6 is about avoiding this).', '如果没有任何计划能让小车不撞墙，问题就无解（infeasible）；这时这个控制器全力刹车（怎样避免走到这一步，M6 讲）。') },
        { lines: [21, 21], text: t('Of the N planned accelerations, only the first leaves the function.', 'N 个计划好的加速度里，只有第一个被返回。') },
        { lines: [23, 27], text: t('The loop: plan from where you are, apply one step, measure, repeat. This is the "receding horizon": the window always starts now.', '这个循环：从当前位置做计划，执行一步，测量，再来。这就是"滚动时域"：窗口总是从此刻开始。') },
      ],
    },
    {
      id: 'first-predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'first-step', purpose: 'predict',
      prompt: t(
        'At $t = 0$ the controller computes a plan that, if followed, docks the cart. Why not simply execute that whole plan instead of re-solving every 0.1 s?',
        '在 $t = 0$ 时，控制器算出了一个计划，照着做就能停稳。为什么不干脆把整个计划执行完，而要每 0.1 秒重新求解一次？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('The real cart drifts from the model; re-planning from the measured state corrects for it', '真实的小车会偏离模型；从测得的状态重新规划能纠正这种偏离'), correct: true },
        { id: 'b', label: t('Applying one step at a time saves computation', '一次只执行一步可以省计算'), misconception: 'apply-first-saves-compute', feedback: t('It costs more: one optimisation every 0.1 s instead of one in total.', '恰恰更费：每 0.1 秒解一次优化，而不是总共只解一次。') },
        { id: 'c', label: t('The later steps of a plan usually break the limits', '计划后面的几步通常会违反限制'), feedback: t('Every step of the plan respects the limits; that is how it was chosen.', '计划的每一步都遵守限制，它就是这样被选出来的。') },
        { id: 'd', label: t('Nothing is lost: executing the whole plan works just as well', '没有损失：执行整个计划效果一样好'), misconception: 'plan-once' },
      ] },
      explain: t('Only if the world behaves exactly like the model. Here is what happens when it does not.', '只有在世界完全按模型运转时才是这样。下面看看它不按模型来时会怎样。'),
    },
    {
      id: 'push', kind: 'scene', title: t('A push the model did not expect', '模型没料到的一推'), scene: vis('mpc_replan_push'),
      narration: t(
        'At one second, something pushes the cart: its speed jumps by 0.3 metres per second, and nothing in the model said that would happen. § The grey dashed curve is the plan made at time zero. § Executed blindly, step after step, it never learns about the push, and the cart hits the wall at almost two metres per second. § The blue controller re-plans every tenth of a second from the measured state. It sees the extra speed at once, starts braking earlier, and docks at seven seconds. Applying only the first step is what turns a plan into feedback.',
        '第一秒时，有什么东西推了小车一下：速度一下子多了每秒 0.3 米，而模型里没有任何东西预料到这一点。§灰色虚线是零时刻做的计划。§闭着眼睛一步一步照着执行，它永远不知道被推过，小车以接近每秒两米的速度撞上了墙。§蓝色的控制器每十分之一秒都从测得的状态重新规划。它马上看到多出来的速度，提早开始刹车，七秒时停稳。只执行第一步，正是这一点把计划变成了反馈。'),
    },
    // ------------------------------------------------------------------ how far ahead
    {
      id: 'horizon-predict', kind: 'checkpoint', chapter: t('How far ahead?', '要往前看多远？'), title: t('Guess first', '先猜一猜'), skill: 'horizon-length', purpose: 'predict',
      prompt: t(
        'The cart may drive at up to 2 m/s and brake at up to 1 m/s². Roughly how many seconds ahead must each plan look so that the cart never hits the wall?',
        '小车最快 2 m/s，刹车最多 1 m/s²。每次规划大约要往前看多少秒，才能保证小车永远不撞墙？'),
      question: { type: 'number', answer: 2, tolerance: 0.15, unit: t('s', '秒'), wrong: [
        { answer: 0.1, misconception: 'replan-fixes-short-horizon', feedback: t('Re-planning every 0.1 s does not help if no plan ever sees the stop coming.', '如果没有一个计划能看见"该刹车了"，每 0.1 秒重新规划一次也没用。') },
        { answer: 1, feedback: t('Braking from 2 m/s at 1 m/s² takes 2 s, not 1.', '以 1 m/s² 从 2 m/s 刹停要 2 秒，不是 1 秒。') },
      ] },
      explain: t('About as long as it takes to stop: $v_{\\max} / a_{\\max} = 2$ s. Check it, and find the exact number, next.', '大约是刹停所需的时间：$v_{\\max} / a_{\\max} = 2$ 秒。下面来验证，并找出准确的数。'),
    },
    {
      id: 'horizon-world', kind: 'explore', title: t('Find the shortest look-ahead', '找出最短的预测时域'), skill: 'horizon-length',
      scene: vis('mpc_dock_horizon'),
      prompt: t(
        'Drag the look-ahead $N$ and let go to run the cart. (1) With brakes of 1 m/s², find the **shortest** $N$ that docks without hitting the wall. (2) Switch to brakes of 0.5 m/s² and find the shortest $N$ again.',
        '拖动预测时域 $N$，松手后小车就开始跑。（1）刹车 1 m/s² 时，找出能停稳、不撞墙的**最短** $N$。（2）把刹车换成 0.5 m/s²，再找一次最短的 $N$。'),
      cue: [DOCK_LABELS.N, DOCK_LABELS.brakes],
      setup: attach('mpc_dock_horizon'),
      goals: [
        { id: 'strong', check: (_s, _c, w) => { const r = last(w); return !!r && r.a === 1 && r.N === 19 && !r.crashed; }, message: t(
          '19 steps, 1.9 s. Braking from 2 m/s takes 2 s, but in steps of 0.1 s the last step moves the cart only 5 mm. So a 1.9 s window already sees that any delay crosses the wall inside it, and brakes fully at once. With 18 steps the plan can brake 0.95 instead of 1 and still stay off the wall inside its own window; that shortfall is what hits at 0.14 m/s.',
          '19 步，1.9 秒。从 2 m/s 刹停要 2 秒，可是按每步 0.1 秒算，最后一步小车只走 5 毫米。所以 1.9 秒的窗口已经能看出：刹车哪怕晚一步，窗口里就会越过墙，于是它立刻全力刹车。只看 18 步时，计划刹 0.95 而不是 1，在自己的窗口里照样碰不到墙；差的这一点，最后变成了以 0.14 m/s 撞墙。') },
        { id: 'weak', check: (_s, _c, w) => { const r = last(w); return !!r && r.a === 0.5 && r.N === 40 && !r.crashed; }, message: t(
          '40 steps, 4 s. Half the braking means twice the time to stop, so the window has to be twice as long.',
          '40 步，4 秒。刹车减半，刹停的时间就翻倍，窗口也得跟着翻倍。') },
      ],
      detectors: [
        { id: 'record', on: (e, w) => { if (e.type === 'released') w.state.last = e.data as Released; return null; } },
        { id: 'short-replan', on: (e) => {
          const r = e.data as Released | undefined;
          return e.type === 'released' && r && r.a === 1 && r.crashed && r.N <= 15 ? { kind: 'misconception', id: 'replan-fixes-short-horizon', message: t(
            'It re-planned every 0.1 s, fifty times before the crash, and still hit: inside each short window nothing said "brake" yet. The danger lay past the window’s end.',
            '它每 0.1 秒重新规划一次，撞墙之前规划了五十多次，还是撞了：在每一个短窗口里，都还没有任何迹象说"该刹车了"。危险在窗口的尽头之外。') } : null;
        } },
        { id: 'fixed-number', on: (e) => {
          const r = e.data as Released | undefined;
          return e.type === 'released' && r && r.a === 0.5 && r.crashed && r.N >= 19 && r.N < 40 ? { kind: 'misconception', id: 'horizon-fixed-number', message: t(
            'The look-ahead that docked with strong brakes is not enough now: with half the braking the stop takes twice as long, and so must the window.',
            '刹车强时够用的预测时域，现在不够了：刹车减半，刹停要花两倍的时间，窗口也得是两倍长。') } : null;
        } },
        { id: 'longer-free', on: (e) => {
          const r = e.data as Released | undefined;
          return e.type === 'released' && r && r.a === 1 && !r.crashed && r.N >= 30 ? { kind: 'misconception', id: 'longer-is-free', message: t(
            `It docks at ${r.docked_t.toFixed(1)} s, only ${(7.3 - r.docked_t).toFixed(1)} s sooner than with 19 steps. But every 0.1 s it now solves for ${r.N} accelerations instead of 19, and trusts the model ${(r.N / 10).toFixed(1)} s ahead.`,
            `它在 ${r.docked_t.toFixed(1)} 秒停稳，只比 19 步早 ${(7.3 - r.docked_t).toFixed(1)} 秒。可它现在每 0.1 秒要解 ${r.N} 个加速度而不是 19 个，还要相信模型对 ${(r.N / 10).toFixed(1)} 秒之后的预测。`) } : null;
        } },
        { id: 'close', on: (e) => {
          const r = e.data as Released | undefined;
          return e.type === 'released' && r && r.a === 1 && r.crashed && r.N >= 16 && r.N <= 18 ? { kind: 'progress', id: 'close' } : null;
        } },
        { id: 'docks-long', on: (e) => {
          const r = e.data as Released | undefined;
          return e.type === 'released' && r && !r.crashed && ((r.a === 1 && r.N > 19) || (r.a === 0.5 && r.N > 40)) ? { kind: 'progress', id: 'docks-long' } : null;
        } },
      ],
      lines: [
        { text: t('Solid is what the cart did. Dashed is the plan it made at the last moment a stop still fitted. Watch where the dashed plan ends.', '实线是小车实际的运动。虚线是它在"还来得及刹停"的最后时刻做的计划。注意虚线在哪里结束。'), when: 'enter' },
        { text: t('Look at the plan’s first step on the right. Does it brake, and by how much?', '看右边计划的第一步：它刹车了吗？刹了多少？'), when: 'idle' },
        { text: t('Re-planning did not save it. Each short plan ended at the wall still moving, and saw nothing wrong.', '重新规划没能救它。每一个短计划都在墙边结束，速度还没降下来，而它看不出有什么不对。'), when: { finding: 'replan-fixes-short-horizon' } },
        { text: t('Close. The plan already brakes at five seconds, just not fully. One more step of look-ahead at a time.', '很接近了。计划在第五秒已经在刹车，只是没刹满。一步一步再往前多看一点。'), when: { finding: 'close' } },
        { text: t('It docks. Is it the shortest that does? Take one step off at a time.', '停稳了。但这是最短的吗？一次减一步试试。'), when: { finding: 'docks-long' } },
        { text: t('Weaker brakes, longer stop. The window has to grow with it.', '刹车弱了，刹停就更久，窗口也得跟着变长。'), when: { finding: 'horizon-fixed-number' } },
        { text: t('Longer still docks, barely sooner. The price is paid elsewhere: in solve time and in trust in the model.', '再长也能停稳，只是快不了多少。代价付在别处：求解时间，以及对模型的信任。'), when: { finding: 'longer-is-free' } },
        { text: t('The look-ahead has to cover the time it takes to stop: top speed over braking.', '预测时域得盖住刹停所需的时间：最高速度除以最大减速度。'), when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.a.set_value(1);
        s.N.set_value(19);
        w.emit('released', s.result());
        s.a.set_value(0.5);
        s.N.set_value(40);
        w.emit('released', s.result());
      },
    },
    {
      id: 'takeaway', kind: 'read', title: t('The rule, and its price', '规则，以及它的代价'),
      blocks: [
        { type: 'p', text: t('The plan must look at least as far ahead as it takes to stop:', '计划往前看的时间，至少要等于刹停所需的时间：') },
        { type: 'math', tex: 'N\\,\\Delta t \\;\\gtrsim\\; \\frac{v_{\\max}}{a_{\\max}} \\qquad \\Big(\\tfrac{2}{1} = 2\\text{ s} \\to N = 19; \\quad \\tfrac{2}{0.5} = 4\\text{ s} \\to N = 40\\Big)' },
        { type: 'p', text: t('Why 19 and not 20? A full stop from 2 m/s takes 20 steps of 0.1 s, but the last one moves the cart only 5 mm. A 19-step window already shows that braking one step late would cross the wall, so the plan brakes fully at once.', '为什么是 19 而不是 20？从 2 m/s 刹停要 20 个 0.1 秒的步，可最后一步小车只走 5 毫米。19 步的窗口已经能看出：晚一步刹车就会越过墙，所以计划立刻全力刹车。') },
        { type: 'list', items: [
          t('**Short plans are not wrong by their own lights.** The 1 s plan at $t = 5$ s says "no braking yet" and keeps every constraint inside its window: it ends at the wall at 2 m/s, and the crash happens just after the window closes. Re-planning more often cannot fix that, because every plan has the same blind spot.', '**短计划按它自己的标准并没有错。** $t = 5$ 秒时那个只看 1 秒的计划说"先不刹车"，而且在它的窗口里每条约束都满足：它在墙边结束，速度还是 2 m/s，撞墙发生在窗口刚结束之后。重新规划得再勤也没用，因为每一个计划都有同样的盲区。'),
          t('**The limits set the horizon.** Halve the brakes and the look-ahead doubles. There is no universal "good N".', '**限制决定时域。** 刹车减半，预测时域就要翻倍。不存在一个放之四海皆准的"好 N"。'),
          t('**Longer is not free.** 30 steps docked only 0.2 s sooner than 19. Every extra step is another unknown to solve for, every 0.1 s (M5), and a prediction further out, where the model is less right (M7).', '**更长不是免费的。** 30 步只比 19 步早停 0.2 秒。多一步就多一个未知量，而且每 0.1 秒都要重解一次（M5）；预测也伸得更远，那里模型更不准（M7）。'),
          t('**There is a cheaper fix than a long window:** tell a short plan what must be true at its end, for instance "be able to stop by then". That is the terminal cost and terminal set of M6.', '**还有比长窗口更省的办法：** 告诉短计划它结束时必须满足什么，比如"到那时还刹得住"。这就是 M6 的终端代价和终端集。'),
        ] },
        { type: 'callout', kind: 'note', title: t('A real look-ahead', '一个真实的预测时域'), body: t(
          'The linear and nonlinear MPCs that flew a hexacopter in Kamel et al. (2017) predicted 20 steps, 2 s ahead, and re-planned 100 times a second[^kamel].',
          'Kamel 等人（2017）在六旋翼无人机上跑的线性和非线性 MPC，都往前预测 20 步、2 秒，每秒重新规划 100 次[^kamel]。') },
        { type: 'cite', key: 'kamel', text: t('Kamel, Burri & Siegwart (2017). Linear vs Nonlinear MPC for Trajectory Tracking Applied to Rotary Wing Micro Aerial Vehicles. IFAC-PapersOnLine 50(1).', 'Kamel、Burri 与 Siegwart（2017）。Linear vs Nonlinear MPC for Trajectory Tracking Applied to Rotary Wing Micro Aerial Vehicles。IFAC-PapersOnLine 50(1)。'), url: 'https://arxiv.org/abs/1611.09240' },
      ],
    },
    // ------------------------------------------------------------------ the course
    {
      id: 'preview', kind: 'read', chapter: t('The course', '这门课'), title: t('Where MPC runs, and what comes next', 'MPC 用在哪儿，接下来讲什么'),
      blocks: [
        { type: 'p', text: t('MPC is not a lab curiosity. Three places it runs:', 'MPC 不是实验室里的稀罕玩意儿。举三个在用它的地方：') },
        { type: 'list', items: [
          t('**Refineries and chemical plants**, by far its largest user in a 1999 survey of over 4600 industrial applications. There it runs about once a minute, on top of PID loops that run every second[^qin].', '**炼油厂和化工厂**：一项 1999 年的调查统计了 4600 多个工业应用，这里是用得最多的地方。在那里它大约一分钟算一次，下面垫着每秒运行的 PID 回路[^qin]。'),
          t('**Legged robots**: MIT’s Cheetah 3 chose its foot forces with an MPC looking up to 0.5 s ahead, solved in under 1 ms, 20–30 times a second[^cheetah].', '**足式机器人**：MIT 的 Cheetah 3 用 MPC 决定每只脚的着地力，往前看最多 0.5 秒，求解不到 1 毫秒，每秒 20 到 30 次[^cheetah]。'),
          t('**Car engines**: a turbocharged gasoline engine torque controller built on MPC was scheduled for production by General Motors from 2018[^gm].', '**汽车发动机**：一套基于 MPC 的涡轮增压汽油机扭矩控制器，计划自 2018 年起在通用汽车量产[^gm]。'),
        ] },
        { type: 'p', text: t(
          'Note the refinery: MPC did not replace PID, it sits above it. When there is one loop and no limit that matters, a well-tuned PID is simpler, cheaper and just as good. MPC earns its cost when limits bind and the controller has to plan around them.',
          '注意炼油厂的例子：MPC 没有取代 PID，而是坐在 PID 上面。只有一个回路、也没有要紧的限制时，调好的 PID 更简单、更便宜，效果一样好。限制真的会碰上、控制器必须提前绕着它们做计划时，MPC 才值这个代价。') },
        { type: 'table', head: [t('Lesson', '课'), t('Question', '问题')], rows: [
          [t('M2 The model', 'M2 模型'), t('Where do $A$ and $B$ come from, and why are predictions linear in the inputs?', '$A$ 和 $B$ 从哪来？为什么预测对输入是线性的？')],
          [t('M3 The cost', 'M3 代价'), t('How do the weights trade speed against effort, and what happens without limits?', '权重怎样在速度和用力之间权衡？没有限制时会怎样？')],
          [t('M4 Constraints', 'M4 约束'), t('What does writing the limits in do to the problem and its solution?', '把限制写进去，问题和解会变成什么样？')],
          [t('M5 Solving', 'M5 求解'), t('How is it solved fast enough, every step?', '怎样每一步都解得足够快？')],
          [t('M6 Stability and feasibility', 'M6 稳定与可行'), t('How can a short plan be made safe?', '怎样让短计划也安全？')],
          [t('M7 When the model is wrong', 'M7 模型不准时'), t('What if there is a slope the model does not know?', '如果有一段模型不知道的坡呢？')],
          [t('M8 Nonlinear MPC', 'M8 非线性 MPC'), t('What changes for a car on a curved road, and when to pick which controller?', '换成弯道上的汽车会有什么不同？什么时候该选哪种控制器？')],
        ] },
        { type: 'cite', key: 'qin', text: t('Qin & Badgwell (2003). A survey of industrial model predictive control technology. Control Engineering Practice 11(7), 733–764 (Tables 6–7, Fig. 2).', 'Qin 与 Badgwell（2003）。A survey of industrial model predictive control technology。Control Engineering Practice 11(7)，733–764（表 6–7，图 2）。'), url: 'https://doi.org/10.1016/S0967-0661(02)00186-7' },
        { type: 'cite', key: 'cheetah', text: t('Di Carlo et al. (2018). Dynamic Locomotion in the MIT Cheetah 3 Through Convex Model-Predictive Control. IROS.', 'Di Carlo 等（2018）。Dynamic Locomotion in the MIT Cheetah 3 Through Convex Model-Predictive Control。IROS。'), url: 'https://doi.org/10.1109/IROS.2018.8594448' },
        { type: 'cite', key: 'gm', text: t('Bemporad, Bernardini, Long & Verdejo (2018). Model Predictive Control of Turbocharged Gasoline Engines for Mass Production. SAE 2018-01-0875.', 'Bemporad、Bernardini、Long 与 Verdejo（2018）。Model Predictive Control of Turbocharged Gasoline Engines for Mass Production。SAE 2018-01-0875。'), url: 'https://doi.org/10.4271/2018-01-0875' },
      ],
    },
    // ------------------------------------------------------------------ checks
    {
      id: 'q-steps', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('A faster cart', '更快的小车'), skill: 'horizon-length', purpose: 'check',
      prompt: t(
        'A different cart may drive at up to 3 m/s and brake at up to 1.5 m/s², and its MPC re-plans every 0.05 s. About how many steps must its look-ahead $N$ be?',
        '换一辆小车：最快 3 m/s，刹车最多 1.5 m/s²，它的 MPC 每 0.05 秒重新规划一次。它的预测时域 $N$ 大约要多少步？'),
      question: { type: 'number', answer: 40, tolerance: 2, unit: t('steps', '步'), wrong: [
        { answer: 20, feedback: t('That is 2 s in steps of 0.1 s; this controller’s steps are 0.05 s.', '这是按每步 0.1 秒算的 2 秒；这个控制器每步是 0.05 秒。') },
        { answer: 2, feedback: t('2 s is the time to stop; the question asks for steps of 0.05 s.', '2 秒是刹停的时间；题目问的是多少个 0.05 秒的步。') },
        { answer: 3, feedback: t('3 m is the stopping distance, $v^2 / 2a$; the window is measured in time.', '3 米是刹停的距离 $v^2 / 2a$；窗口是按时间算的。') },
      ] },
      explain: t('Time to stop $3 / 1.5 = 2$ s, so about $2 / 0.05 = 40$ steps (the step grid may shave one off, as 19 did for 20).', '刹停时间 $3 / 1.5 = 2$ 秒，所以大约 $2 / 0.05 = 40$ 步（步长网格可能让它少一步，就像 20 变成 19 那样）。'),
    },
    {
      id: 'q-skip', kind: 'checkpoint', title: t('Three steps per plan', '一次计划用三步'), skill: 'first-step', purpose: 'check',
      prompt: t(
        'An MPC must run at 100 Hz, but each solve takes 30 ms. An engineer re-plans only every third step and applies the first three planned inputs each time. What does the controller lose, compared with true MPC?',
        '一个 MPC 要以 100 Hz 运行，但每次求解要 30 毫秒。一位工程师改成每三步才规划一次，每次执行计划里的前三个输入。和真正的 MPC 比，这个控制器损失了什么？'),
      question: { type: 'text', placeholder: t('Between two solves…', '两次求解之间……'), rubric: {
        key_points: [
          t('For three steps the inputs are applied open loop: a disturbance during them is not seen until the next plan.', '这三步里，输入是开环执行的：期间出现的扰动要等到下一次规划才会被看见。'),
          t('Feedback is delayed/slower (one correction per 30 ms instead of per 10 ms), so it reacts later to anything the model did not predict.', '反馈被推迟、变慢了（30 毫秒纠正一次，而不是 10 毫秒），对模型没预料到的事情反应得更晚。'),
        ],
        model_answer: t(
          'Between solves it runs open loop: the second and third inputs were chosen for a predicted state, not the measured one, so a push or a model error goes uncorrected for up to 30 ms. Its feedback is three times slower; the limits still hold only as far as the model is right.',
          '两次求解之间它是开环运行的：第二、第三个输入是按预测的状态选的，而不是按测得的状态，所以一次推力或模型误差最多要 30 毫秒才得到纠正。反馈慢了三倍；限制能不能守住，也只取决于模型准不准。'),
        min_points: 1,
      } },
    },
    {
      id: 'q-which', kind: 'checkpoint', title: t('Which one needs MPC?', '哪个需要 MPC？'), skill: 'mpc-vs-pid', purpose: 'check',
      prompt: t('In which of these is MPC most clearly worth its extra cost over a well-tuned PID?', '下面哪种情况，最明显值得为 MPC 多付出代价，而不是用一个调好的 PID？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('A train that must stop exactly at a platform mark, with limited braking and a speed limit on the way', '一列火车要精确停在站台标记处，刹车能力有限，途中还有限速'), correct: true },
        { id: 'b', label: t('A room heater holding 21 °C, far below its maximum power', '一台暖气保持室温 21 °C，功率远没用到上限'), misconception: 'mpc-always-better', feedback: t('No limit binds and there is one loop: a PID does this well, more simply.', '没有限制会碰上，也只有一个回路：PID 能做好，而且更简单。') },
        { id: 'c', label: t('A motor speed loop at 10 kHz whose current never reaches its limit', '一个 10 kHz 的电机转速环，电流从不碰到上限'), misconception: 'mpc-always-better', feedback: t('Without binding limits there is nothing to plan around, and 0.1 ms leaves little time for an optimisation.', '没有会碰上的限制，就没什么需要提前绕开；0.1 毫秒也很难留出时间解优化问题。') },
        { id: 'd', label: t('Any of them: MPC is the better controller in general', '哪个都行：MPC 一般来说就是更好的控制器'), misconception: 'mpc-always-better' },
      ] },
      explain: t('MPC pays off when limits bind and the controller must act before reaching them, like braking for the platform. Where no limit matters, PID stays simpler; even in refineries it runs underneath MPC.', '当限制真的会碰上、控制器必须在碰到之前就动手（比如为站台提前刹车）时，MPC 才划算。限制无关紧要的地方，PID 更简单；即使在炼油厂，PID 也在 MPC 下面跑着。'),
    },
    {
      id: 'q-violate', kind: 'checkpoint', title: t('A plan that ends at the wall', '一个在墙边结束的计划'), skill: 'mpc-loop', purpose: 'check',
      prompt: t(
        'With a 1 s look-ahead, the plan at $t = 5$ s (cart at 8 m, 2 m/s) says "no braking" and ends exactly at the wall, still at 2 m/s. The run then hits the wall. Did that plan break any of its constraints?',
        '预测时域 1 秒时，$t = 5$ 秒的计划（小车在 8 米处，2 m/s）说"不刹车"，并且恰好在墙边结束，速度仍是 2 m/s。随后小车撞了墙。那个计划违反了它的约束吗？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('No: every constraint holds inside its window; the crash lies after the window ends', '没有：窗口内每条约束都成立；撞墙发生在窗口结束之后'), correct: true },
        { id: 'b', label: t('Yes: the solver must have made an error, since the cart crashed', '违反了：小车既然撞了，求解器一定出了错'), misconception: 'plan-sees-everything' },
        { id: 'c', label: t('Yes: 2 m/s at the wall breaks the speed limit', '违反了：在墙边还有 2 m/s，超了限速'), feedback: t('The limit is $|v| \\le 2$; 2 m/s is allowed.', '限制是 $|v| \\le 2$，2 m/s 是允许的。') },
        { id: 'd', label: t('It could not have been solved: the problem was infeasible', '它根本解不出来：问题无解'), feedback: t('Not yet: at $t = 5$ s a plan that keeps $p \\le 10$ for one second exists, and that is all it asks.', '那时还没有：$t = 5$ 秒时，存在能在一秒内保持 $p \\le 10$ 的计划，而它要求的就只有这些。') },
      ] },
      explain: t('A plan only promises what happens inside its window. Keeping the run safe needs a window that reaches past the stop, or a condition on the plan’s end (M6).', '计划只对窗口之内负责。要让整段运行都安全，窗口得伸到刹停之后，或者给计划的结尾加一个条件（M6）。'),
    },
  ],
};
