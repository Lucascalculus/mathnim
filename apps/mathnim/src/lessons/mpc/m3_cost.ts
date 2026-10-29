// M3 代价：想要什么 / The cost: saying what you want. The quadratic cost and
// its weights (a price list, not a set of limits), the unconstrained optimum
// as linear feedback, the horizon and the terminal cost, Riccati and LQR, and
// when LQR is enough. Plan and numbers: docs/lessons/mpc/checkpoints/m3.md;
// sources: docs/lessons/mpc/research-m3.md. Visuals: mpc_weights, mpc_gain_horizon.
import type { Lesson } from '@mathnim/core';
import { attach, t, vis } from './common';

const GAIN_CODE = `import numpy as np
from scipy.linalg import block_diag, solve_discrete_are
dt = 0.1
A = np.array([[1, dt], [0, 1]]); B = np.array([[dt**2 / 2], [dt]])
Q = np.diag([1.0, 0.0]); R = np.array([[0.1]])
def gain(N, P):
    n, m = B.shape
    Phi = np.vstack([np.linalg.matrix_power(A, k) for k in range(1, N + 1)])
    Gam = np.zeros((n * N, m * N))
    for k in range(N):
        for j in range(k + 1):
            Gam[n*k:n*k+n, m*j:m*j+m] = np.linalg.matrix_power(A, k - j) @ B
    Qbar = block_diag(*[Q] * (N - 1), P); Rbar = block_diag(*[R] * N)
    H = 2 * (Gam.T @ Qbar @ Gam + Rbar); F = 2 * Gam.T @ Qbar @ Phi
    return np.linalg.solve(H, F)[:m]
P_inf = solve_discrete_are(A, B, Q, R)
K_lqr = np.linalg.solve(R + B.T @ P_inf @ B, B.T @ P_inf @ A)
print(gain(5, Q))      # [[1.171 0.444]]  short horizon, P = Q: weak
print(gain(20, Q))     # [[2.701 2.323]]  longer: close to LQR
print(K_lqr)           # [[2.789 2.362]]
print(gain(1, P_inf))  # [[2.789 2.362]]  one step, but the tail priced exactly`;

const Q_V = t('q_v: the price of speed', 'q_v：速度的价格');
const R_L = t('r: the price of effort', 'r：用力的价格');

export const lesson: Lesson = {
  id: 'mpc-m3-cost',
  title: t('The cost: saying what you want', '代价：想要什么'),
  description: t(
    'How a quadratic cost tells the planner what "best" means, what each weight buys, why the plan without limits is a fixed feedback gain, and how a long horizon or the right terminal cost gives LQR.',
    '二次代价怎样告诉规划器"最好"是什么意思，每个权重买到的是什么，为什么没有约束时计划就是一个固定的反馈增益，以及足够长的时域或合适的终端代价怎样给出 LQR。'),
  mode: 'essay',
  skills: [
    { id: 'cost-terms', name: t('What each term of the quadratic cost does', '二次代价里每一项的作用') },
    { id: 'weights-tradeoff', name: t('Weights as prices: speed against effort', '权重是价格：速度与用力的取舍'), prerequisites: ['cost-terms'] },
    { id: 'unconstrained-solution', name: t('The unconstrained optimum is linear feedback', '无约束最优解是线性反馈'), prerequisites: ['cost-terms'] },
    { id: 'riccati-lqr', name: t('Horizon, terminal cost, Riccati and LQR', '时域、终端代价、Riccati 与 LQR'), prerequisites: ['unconstrained-solution'] },
    { id: 'lqr-or-mpc', name: t('When LQR is enough and when you need MPC', '什么时候 LQR 就够，什么时候需要 MPC'), prerequisites: ['weights-tradeoff', 'riccati-lqr'] },
  ],
  misconceptions: [
    { id: 'r-damps', description: t('A larger effort price r makes the motion less oscillatory (less overshoot).', '用力的价格 r 越大，运动越不晃（超调越小）。'), remediation: 'r-sweep' },
    { id: 'cost-is-limit', description: t('A large effort weight works like a limit: the controller pushes up to it and no further, so it can still be as fast as the limit allows.', '用力的权重大就相当于一个上限：控制器推到它为止，所以仍然能像真有上限时那样快。') },
    { id: 'weights-absolute', description: t('The size of the weights matters on its own, not just their ratios.', '权重本身的大小有意义，而不只是它们之间的比例。') },
    { id: 'gain-fixed-push', description: t('A tuned controller always pushes about as hard, whatever the state.', '调好的控制器不管处在什么状态，推力都差不多大。') },
    { id: 'short-horizon-aggressive', description: t('A shorter horizon makes the controller hurry, so it pushes harder.', '时域越短，控制器越急，推得越猛。'), remediation: 'gain-horizon' },
    { id: 'horizon-irrelevant', description: t('The behaviour is set by the weights alone; the horizon and the terminal cost do not change it.', '行为只由权重决定；时域和终端代价不会改变它。'), remediation: 'gain-horizon' },
    { id: 'mpc-always', description: t('MPC is always better than LQR, even when no limit is ever reached.', 'MPC 永远比 LQR 好，即使从来碰不到任何限制。') },
  ],
  steps: [
    // ------------------------------------------------------------------ the idea
    {
      id: 'why', kind: 'read', chapter: t('What "best" means', '"最好"是什么意思'), title: t('The planner needs a score', '规划器需要一个分数'),
      blocks: [
        { type: 'p', text: t(
          'M1’s planner tried many plans and kept the best one; M2 gave it the predictions $X = \\Phi x_0 + \\Gamma U$ of every plan $U$. One question is left: **which plan is best?** "Get there fast and smoothly" is not something an optimizer can use, and the two halves pull against each other: getting there fast needs hard pushes, and smooth motion needs soft ones. So we give every plan a single number, the cost $J$, and let the optimizer find the plan with the smallest one.',
          'M1 的规划器试了很多计划，留下最好的那个；M2 给了它每个计划 $U$ 的预测 $X = \\Phi x_0 + \\Gamma U$。还剩一个问题：**哪个计划最好？**"又快又稳地到达"这句话优化器用不了，而且前后两半互相打架：要快就得猛推，要稳就得轻推。所以我们给每个计划打一个分，也就是代价 $J$，让优化器去找分数最小的计划。') },
        { type: 'math', tex: 'J = \\sum_{k=0}^{N-1} \\big( x_k^\\top Q\\, x_k + u_k^\\top R\\, u_k \\big) + x_N^\\top P\\, x_N' },
        { type: 'list', items: [
          t('$x_k^\\top Q x_k$: how far from the goal the predicted state is at step $k$. $Q$ says which errors you care about, and how much.', '$x_k^\\top Q x_k$：第 $k$ 步预测的状态离目标有多远。$Q$ 规定你在意哪些偏差、在意到什么程度。'),
          t('$u_k^\\top R u_k$: how hard the plan pushes. $R$ is the price of effort: fuel, wear, a passenger’s comfort.', '$u_k^\\top R u_k$：计划推得有多用力。$R$ 是用力的价格：燃料、磨损、乘客的舒适。'),
          t('$x_N^\\top P x_N$: the terminal cost, a price on where the plan leaves the system at the end of the window. It will matter more than it looks (second half of this lesson).', '$x_N^\\top P x_N$：终端代价，给计划在窗口末尾把系统留在哪里定一个价。它比看上去重要得多（本课后半部分）。'),
        ] },
        { type: 'p', text: t(
          'On the cart (start at rest at 0, stop at the flag at 6 m), with $Q = \\mathrm{diag}(1, q_v)$ and $R = r$, the cost reads like a bill with three lines:',
          '放到小车上（从 0 静止出发，停在 6 m 处的旗子），取 $Q = \\mathrm{diag}(1, q_v)$、$R = r$，代价就像一张有三行的账单：') },
        { type: 'math', tex: 'J = \\sum_k \\big( (p_k - 6)^2 + q_v\\, v_k^2 + r\\, a_k^2 \\big)' },
        { type: 'p', text: t(
          'Every step away from the flag costs; moving fast costs $q_v$ per (m/s)²; pushing costs $r$ per (m/s²)². The price of distance is fixed at 1, because **only the ratios matter**: multiply all three prices by 10 and every plan’s bill is 10 times larger, so the cheapest plan is still the same one. M1 used $q_v = 0$, $r = 0.1$.',
          '离旗子远一步就要付钱；跑得快，每 (m/s)² 付 $q_v$；用力推，每 (m/s²)² 付 $r$。距离的价格固定为 1，因为**只有比例有意义**：三个价格同时乘以 10，每个计划的账单都变成 10 倍，最便宜的还是同一个计划。M1 用的是 $q_v = 0$、$r = 0.1$。') },
        { type: 'details', summary: t('Why squares, and not absolute values or a maximum?', '为什么用平方，而不用绝对值或最大值？'), blocks: [
          { type: 'list', items: [
            t('**Big errors cost much more than small ones.** Twice as far costs four times as much, so the optimizer works hardest on the worst part of the plan.', '**大偏差比小偏差贵得多。**远一倍，代价是四倍，所以优化器会把最多的力气花在计划最差的那部分上。'),
            t('**Smooth and bowl-shaped.** With $R \\succ 0$ the cost is a strictly convex quadratic in $U$: one bottom, no false minima, and the derivative is linear (this lesson’s derivation).', '**光滑，而且是碗形的。**只要 $R \\succ 0$，代价就是 $U$ 的严格凸二次函数：只有一个最低点，没有假的极小值，导数是线性的（本课的推导）。'),
            t('**Absolute values** (1-norms) are also used in MPC and give a linear program, but their optima jump between corners and tend to bang the input; squares give gentle, proportional answers. We stay with squares, as almost all of the course does.', '**绝对值**（1 范数）在 MPC 里也有人用，得到的是线性规划，但最优解会在角点之间跳，输入容易一会儿猛推一会儿不推；平方给出的是平缓、成比例的答案。我们和课程的绝大部分一样，用平方。'),
          ] },
        ] },
      ],
    },
    {
      id: 'r-predict', kind: 'checkpoint', chapter: t('What the weights buy', '权重买到的是什么'), title: t('Guess first', '先猜一猜'), skill: 'weights-tradeoff', purpose: 'predict',
      prompt: t(
        'For now, no limits: the planner may push as hard as it likes, with a long horizon. With $q_v = 0.01$, $r = 0.1$ the cart’s first push is 16.7 m/s², it overshoots the flag by about 25 cm and settles by 3.8 s. Now make effort 100 times more expensive: $r = 10$. What happens?',
        '先不考虑任何限制：规划器想推多猛都行，时域也足够长。取 $q_v = 0.01$、$r = 0.1$ 时，小车第一下推力是 16.7 m/s²，冲过旗子约 25 cm，3.8 秒到达。现在把用力的价格提高 100 倍：$r = 10$。会怎样？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('It pushes less and also overshoots less', '推得更轻，超调也更小'), misconception: 'r-damps', feedback: t('Pushing less is right. But the overshoot is not set by $r$: watch it next.', '推得更轻没错。但超调不是由 $r$ 决定的：下面看。') },
        { id: 'b', label: t('Same shape, just slower: about a ninth of the push, about the same overshoot', '形状不变，只是变慢：推力约为九分之一，超调差不多'), correct: true },
        { id: 'c', label: t('It stops short of the flag, because pushing all the way costs too much', '停在旗子前面，因为一路推过去太贵'), feedback: t('Standing still at the flag costs nothing ($a = 0$, $p = 6$): any $r$ still ends there. Expensive effort makes the trip slower, not shorter.', '在旗子处静止不花一分钱（$a = 0$，$p = 6$）：不管 $r$ 多大，最后都停在那里。用力贵了，路程变慢，而不是变短。') },
        { id: 'd', label: t('The same push, only started later', '推力一样大，只是晚一点才推') },
      ] },
      explain: t('Simulation: first push 1.82 m/s², overshoot 26 cm, settled at 12 s. Same shape on a slower clock.', '模拟结果：第一下推力 1.82 m/s²，超调 26 cm，12 秒到达。形状一样，只是时钟慢了。'),
    },
    {
      id: 'r-sweep', kind: 'scene', title: t('Changing only the price of effort', '只改用力的价格'), scene: vis('mpc_weights', { story: 'sweep_r', briefs: false }),
      narration: t(
        'The cart runs to the flag with cheap effort: one big push, a quick arrival, and a small overshoot, about a quarter of a metre. § Now the price of effort rises a thousandfold. The push shrinks, the trip stretches out, but look at the overshoot label: it stays near twenty-five centimetres. § Then effort gets cheap: the pushes are huge, the trip is short, and the overshoot is still the same. § The price of effort sets the pace, not the shape.',
        '先看用力便宜的时候：猛推一下，很快到达，冲过旗子一点点，大约四分之一米。§现在把用力的价格提高一千倍。推力变小了，路程拉长了，但请盯住超调的标注：它一直在二十五厘米左右。§再把用力变得很便宜：推力大得惊人，路程很短，超调还是一样。§用力的价格决定的是快慢，不是形状。'),
    },
    {
      id: 'gentle-predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'weights-tradeoff', purpose: 'predict',
      prompt: t(
        'The real motor can give at most 1 m/s² (the shaded band in the video); the controller does not know that. You may only choose the two prices $q_v$ and $r$, so that $|a|$ never goes above 1 and the overshoot stays within 5 cm. How soon can the cart then be settled at the flag, 6 m away?',
        '真实的电机最多只能给 1 m/s²（刚才视频里的阴影带）；控制器并不知道这一点。你只能选两个价格 $q_v$ 和 $r$，让 $|a|$ 始终不超过 1，超调不超过 5 cm。这样小车最快多久能停稳在 6 m 外的旗子处？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('About 5 s', '约 5 秒'), misconception: 'cost-is-limit', feedback: t('About 4.9 s ($2\\sqrt 6$) is the fastest trip of all: full push for half the way, full braking for the other half. A price cannot make the controller use the whole band like that.', '约 4.9 秒（$2\\sqrt 6$）是所有走法里最快的：前一半全力加速，后一半全力刹车。一个价格没法让控制器这样把整条阴影带用满。') },
        { id: 'b', label: t('About 11 s', '约 11 秒'), correct: true },
        { id: 'c', label: t('Impossible: no weights keep $|a|$ within 1', '做不到：没有任何权重能让 $|a|$ 不超过 1'), feedback: t('A large enough $r$ does it: effort becomes so expensive that every push is small.', '$r$ 足够大就行：用力贵到每一下都推得很轻。') },
      ] },
      explain: t('Simulation: the best any weights do is about 11 s, more than twice the 4.9 s the motor allows. Try it yourself next.', '模拟结果：任何权重最好也只能做到约 11 秒，是电机允许的 4.9 秒的两倍多。下面自己试。'),
    },
    {
      id: 'tune', kind: 'explore', title: t('Two customers, two prices', '两个客户，两个价格'), skill: 'weights-tradeoff',
      scene: vis('mpc_weights'),
      prompt: t(
        'Two customers want different trips to the flag. **A (fast):** settled within 5 s, overshoot within 5 cm. **B (gentle):** $|a|$ never above 1 m/s², overshoot within 5 cm, settled within 14 s. Drag the price of speed $q_v$ and the price of effort $r$ to meet brief A, then brief B. The table turns each limit green when this run keeps it.',
        '两个客户想要不同的走法。**A（要快）：**5 秒内停稳，超调不超过 5 cm。**B（要柔）：**$|a|$ 始终不超过 1 m/s²，超调不超过 5 cm，14 秒内停稳。拖动速度的价格 $q_v$ 和用力的价格 $r$，先满足任务 A，再满足任务 B。这一次满足哪条要求，表里那一格就变绿。'),
      setup: attach('mpc_weights'),
      cue: [Q_V, R_L],
      goals: [
        { id: 'fast', check: (s: any) => s.fast(), message: t('Brief A: a higher price of speed damps the swing (the overshoot falls), and cheap effort keeps the trip short.', '任务 A：提高速度的价格，摆动就被压住了（超调下降），用力便宜，路程就短。') },
        { id: 'gentle', check: (s: any) => s.gentle(), message: t('Brief B: expensive effort keeps every push within 1, and a high price of speed damps the swing. The price is a trip of about 12 s.', '任务 B：用力很贵，每一下推力都在 1 以内；速度的价格高，摆动被压住。代价是整趟要走约 12 秒。') },
      ],
      detectors: [
        { id: 'r-for-overshoot', on: (e) => (e.type === 'weights' && e.data!.which === 'r' && (e.data!.q_v as number) < 0.1 && (e.data!.overshoot as number) > 0.15 ? { kind: 'misconception', id: 'r-damps', message: t('The overshoot is still about 25 cm: $r$ changed the pace, not the swing.', '超调还是 25 cm 左右：$r$ 改的是快慢，不是摆动。') } : null) },
        { id: 'slow-gentle', on: (e) => (e.type === 'weights' && (e.data!.peak as number) <= 1 && (e.data!.arrival as number) > 14 && !e.data!.gentle ? { kind: 'misconception', id: 'cost-is-limit', message: t('$|a|$ is within 1 now, but only because every push is small, so the trip takes too long.', '现在 $|a|$ 在 1 以内了，但那是因为每一下都推得很轻，所以整趟太慢。') } : null) },
      ],
      lines: [
        { text: t('Left: the trip and the push against the motor’s real limit. Right: the two prices, the gain they give, and this run’s numbers next to the two briefs.', '左边是这一趟的位置和推力，阴影是电机真实的上限。右边是两个价格、它们给出的增益，以及这一次的数据和两个任务的对照。'), when: 'enter' },
        { text: t('Raising r only slowed the clock: the overshoot did not move. Which price makes speed itself expensive?', '提高 r 只是让时钟变慢了，超调一点没动。哪个价格是让"速度"本身变贵的？'), when: { finding: 'r-damps' } },
        { text: t('Within the band, but slow. A price never says "up to 1, then stop": it shrinks every push, the early ones most.', '是在阴影带里了，但太慢。价格从来不会说"推到 1 为止"：它把每一下推力都缩小，开头那几下缩得最多。'), when: { finding: 'cost-is-limit' } },
        { text: t('Watch the overshoot row as you drag each slider. One price sets the swing, the other the pace.', '拖动每个滑块时盯住"超调"那一行。一个价格管摆动，另一个管快慢。'), when: 'idle' },
        { text: t('No setting meets both briefs at once: a price can only trade speed against effort. A hard limit needs a constraint, which is M4.', '没有任何设置能同时满足两个任务：价格只能拿速度和用力做交换。真正的硬上限需要约束，这是 M4 的内容。'), when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.q_v.set_value(10 ** -0.5);
        s.r.set_value(0.1);
        w.emit('weights', s.report('q_v'));
        s.q_v.set_value(10 ** 0.8);
        s.r.set_value(10 ** 1.7);
        w.emit('weights', s.report('r'));
      },
    },
    {
      id: 'what-weights-buy', kind: 'read', title: t('What each price buys', '每个价格买到的是什么'),
      blocks: [
        { type: 'table', head: [t('Turn up', '调高'), t('You get', '得到'), t('You pay', '付出')], rows: [
          [t('$r$ (effort)', '$r$（用力）'), t('smaller pushes, the same shape', '推力更小，形状不变'), t('a slower trip', '路程更慢')],
          [t('$q_v$ (speed)', '$q_v$（速度）'), t('less swing, less overshoot', '摆动更少，超调更小'), t('a more cautious approach', '接近得更小心')],
          [t('position (fixed at 1)', '位置（固定为 1）'), t('faster, harder pushes: the same as lowering both others', '更快、推得更猛：等于同时调低另外两个'), t('more effort', '更费力')],
        ] },
        { type: 'p', text: t(
          'The textbook statement is the same in matrix form: large $Q$ compared with $R$ drives the state to the goal quickly at the price of large inputs; large $R$ compared with $Q$ gives gentle inputs and a slow approach[^rmd]. And no setting is fast **and** keeps $|a|$ within 1, because a price has no threshold. It shrinks every push in proportion, and the feedback pushes hardest at the start, when the error is largest. To keep that first push under 1, every later push gets even smaller.',
          '教科书用矩阵语言说的是同一件事：$Q$ 相对 $R$ 大，状态就会很快到达目标，代价是输入很大；$R$ 相对 $Q$ 大，输入就温和，接近得也慢[^rmd]。而且没有任何设置能既快**又**让 $|a|$ 不超过 1，因为价格没有门槛。它把每一下推力按比例缩小，而反馈在一开始误差最大时推得最猛。为了让第一下不超过 1，后面每一下都只能更小。') },
        { type: 'p', text: t(
          '**Where to start.** Bryson’s rule sets each diagonal weight to $1/(\\text{largest acceptable value})^2$. MathWorks calls it "often just the starting point" of trial and error[^mw]. On the cart, "errors up to 6 m, pushes up to 1 m/s²" gives $q_p = 1/36$, $r = 1$, and the first push is 0.97: right for this trip. Start 12 m away and the same weights push 1.94, because the gain is fixed and the push grows with the error (simulation).',
          '**从哪里开始调。**Bryson 法则把每个对角权重设为 $1/(\\text{可接受的最大值})^2$。MathWorks 说它"往往只是"反复试凑的起点[^mw]。放到小车上，"偏差最多 6 m，推力最多 1 m/s²"给出 $q_p = 1/36$、$r = 1$，第一下推力是 0.97：对这一趟正合适。可要是从 12 m 外出发，同样的权重会推到 1.94，因为增益是固定的，推力随偏差一起变大（模拟结果）。') },
        { type: 'details', summary: t('Why r sets the pace and q_v the swing (a closed form)', '为什么 r 管快慢、q_v 管摆动（一个闭式解）'), blocks: [
          { type: 'p', text: t(
            'For small $\\Delta t$ the cart behaves like its continuous version, whose optimal gain has a closed form. The closed loop $\\ddot p + k_v \\dot p + k_p (p - 6) = 0$ is a spring and damper with natural frequency $\\omega$ and damping ratio $\\zeta$:',
            '$\\Delta t$ 很小时，小车和它的连续时间版本几乎一样，而连续版本的最优增益有闭式解。闭环 $\\ddot p + k_v \\dot p + k_p (p - 6) = 0$ 就是一个弹簧加阻尼，固有频率为 $\\omega$，阻尼比为 $\\zeta$：') },
          { type: 'math', tex: 'k_p = \\tfrac{1}{\\sqrt r}, \\quad k_v = \\sqrt{\\tfrac{q_v}{r} + \\tfrac{2}{\\sqrt r}} \\quad\\Rightarrow\\quad \\omega = r^{-1/4}, \\quad \\zeta = \\sqrt{\\tfrac12 + \\tfrac{q_v}{4\\sqrt r}}' },
          { type: 'p', text: t(
            '$r$ alone sets the clock $\\omega$. With $q_v = 0$ the damping is $\\zeta = 1/\\sqrt 2$ for **every** $r$, and a second-order step with that damping overshoots by $e^{-\\pi} \\approx 4.3\\%$: 26 cm of 6 m, the label you watched. Only $q_v / \\sqrt r$ changes the damping, which is why brief B needed a large $q_v$ to go with its large $r$. (Our derivation, checked against the simulation.)',
            '$r$ 单独决定时钟 $\\omega$。当 $q_v = 0$ 时，不管 $r$ 是多少，阻尼比都是 $\\zeta = 1/\\sqrt 2$，而这个阻尼比的二阶系统阶跃响应会超调 $e^{-\\pi} \\approx 4.3\\%$：6 m 的 4.3% 就是 26 cm，也就是你刚才盯着的那个标注。只有 $q_v / \\sqrt r$ 会改变阻尼，所以任务 B 在用很大的 $r$ 时，还得配上很大的 $q_v$。（这是我们自己的推导，已与模拟结果核对。）') },
        ] },
        { type: 'cite', key: 'rmd', text: t('Rawlings, Mayne & Diehl (2020). Model Predictive Control: Theory, Computation, and Design, 2nd ed., §1.3.1.', 'Rawlings、Mayne、Diehl（2020）。Model Predictive Control: Theory, Computation, and Design，第 2 版，§1.3.1。'), url: 'https://sites.engineering.ucsb.edu/~jbraw/mpc/' },
        { type: 'cite', key: 'mw', text: t('MathWorks. lqr: Linear-Quadratic Regulator design (Bryson’s rule).', 'MathWorks。lqr：线性二次调节器设计（Bryson 法则）。'), url: 'https://ch.mathworks.com/help/control/ref/lti.lqr.html' },
      ],
    },
    // ------------------------------------------------------------------ the solution
    {
      id: 'condense', kind: 'derive', chapter: t('The best plan has a formula', '最好的计划有公式'), title: t('Minimize the cost by hand', '亲手把代价最小化'), skill: 'unconstrained-solution',
      intro: t('Without limits we do not need a solver: the cost is a quadratic in the plan $U$, and a quadratic’s minimum has a formula. Put M2’s prediction into $J$.', '没有约束时根本不需要求解器：代价是计划 $U$ 的二次函数，而二次函数的最小值有公式。把 M2 的预测代进 $J$。'),
      lines: [
        { tex: 'J = x_0^\\top Q x_0 + X^\\top \\bar Q X + U^\\top \\bar R U, \\qquad \\bar Q = \\mathrm{diag}(Q, \\dots, Q, P), \\ \\bar R = \\mathrm{diag}(R, \\dots, R)', why: t('The same sum, stacked: $X = (x_1, \\dots, x_N)$ and $U = (u_0, \\dots, u_{N-1})$. The last block of $\\bar Q$ is the terminal weight $P$. $x_0^\\top Q x_0$ is the present, which no plan can change.', '同一个求和，只是叠成了向量：$X = (x_1, \\dots, x_N)$，$U = (u_0, \\dots, u_{N-1})$。$\\bar Q$ 的最后一块是终端权重 $P$。$x_0^\\top Q x_0$ 是现在，任何计划都改变不了它。') },
        { tex: 'J = U^\\top (\\Gamma^\\top \\bar Q \\Gamma + \\bar R)\\, U + 2\\, (\\Gamma^\\top \\bar Q \\Phi\\, x_0)^\\top U + c', why: t('Substitute $X = \\Phi x_0 + \\Gamma U$ and expand. Everything without $U$ goes into the constant $c$.', '代入 $X = \\Phi x_0 + \\Gamma U$ 再展开。不含 $U$ 的项都并进常数 $c$。') },
        { tex: 'J = \\tfrac12\\, U^\\top H\\, U + (F x_0)^\\top U + c, \\qquad H = 2\\,(\\Gamma^\\top \\bar Q \\Gamma + \\bar R), \\quad F = 2\\, \\Gamma^\\top \\bar Q \\Phi', why: t('The standard form the whole course uses. $H$ is the curvature of the bowl, $F x_0$ its tilt, which depends on where the cart is now.', '整门课都用这个标准形式。$H$ 是碗的弯曲程度，$F x_0$ 是碗的倾斜，它取决于小车现在在哪。') },
        { tex: '\\tfrac12\\, h\\, u^2 + g\\, u \\ \\Rightarrow\\ u^* = -\\frac{g}{h}', why: t('With a single input the bowl is a parabola. Its bottom is where the slope $h u + g$ is zero.', '只有一个输入时，碗就是一条抛物线。最低点在斜率 $h u + g$ 为零的地方。') },
        { tex: '\\nabla_U J = H U + F x_0 = 0 \\ \\Rightarrow\\ U^* = -H^{-1} F\\, x_0', why: t('The same step with matrices. $H \\succ 0$ because $R \\succ 0$ (and $\\Gamma^\\top \\bar Q \\Gamma \\succeq 0$), so there is exactly one bottom (Rawlings, Mayne & Diehl, §1.3.1).', '矩阵版本是同一步。因为 $R \\succ 0$（而且 $\\Gamma^\\top \\bar Q \\Gamma \\succeq 0$），所以 $H \\succ 0$，最低点恰好只有一个（Rawlings、Mayne、Diehl，§1.3.1）。') },
        { tex: 'u_0^* = -K_N\\, x_0, \\qquad K_N = \\begin{bmatrix} I_m & 0 & \\cdots & 0 \\end{bmatrix} H^{-1} F', why: t('MPC applies only the first input: $[I_m\\ 0 \\cdots 0]$ keeps the first $m$ rows. $H$ and $F$ do not depend on the state, so neither does $K_N$: a fixed matrix, computed once.', 'MPC 只执行第一个输入：$[I_m\\ 0 \\cdots 0]$ 取出前 $m$ 行。$H$ 和 $F$ 与状态无关，所以 $K_N$ 也与状态无关：一个固定的矩阵，算一次就够。') },
        { tex: 'a_0 = -K_N\\, (x_0 - x_{\\mathrm{ref}}), \\qquad x_{\\mathrm{ref}} = (6, 0)', why: t('To stop at the flag instead of at 0, measure the state from the flag. This works because staying at rest at the flag needs no push ($a = 0$ there).', '要停在旗子处而不是 0 处，就从旗子量起状态。这样做之所以成立，是因为在旗子处静止不需要任何推力（那里 $a = 0$）。') },
      ],
      blank: { line: 3, answer: '-g/h', variables: ['g', 'h'], prompt: t('Where is the bottom of $\\tfrac12 h u^2 + g u$ (with $h > 0$)?', '$\\tfrac12 h u^2 + g u$（$h > 0$）的最低点在哪里？') },
      outro: t('So the "plan" of an MPC without limits is not really a plan: it is a matrix times the state.', '所以，没有约束的 MPC 所谓的"计划"，其实算不上计划：它就是一个矩阵乘以状态。'),
    },
    {
      id: 'feedback', kind: 'read', title: t('A plan that is a feedback law', '一个其实是反馈律的计划'),
      blocks: [
        { type: 'p', text: t('Write the gain out for the cart, $K = [k_p, k_v]$:', '把小车的增益写开，$K = [k_p, k_v]$：') },
        { type: 'math', tex: 'a = -k_p\\,(p - 6) - k_v\\, v' },
        { type: 'p', text: t(
          'That is the PD controller of M1: push in proportion to the distance from the flag, brake in proportion to the speed. The difference is where the numbers come from. M1 tuned $k_p$ and $k_v$ by hand; here they **fall out of the prices**. With $q_v = 0.01$, $r = 0.1$ the cost gives $K = [2.79, 2.38]$.',
          '这正是 M1 里的 PD 控制器：按离旗子的距离成比例地推，按速度成比例地刹。区别在于这些数从哪来。M1 里 $k_p$、$k_v$ 是手调的；这里它们是**从价格里算出来的**。取 $q_v = 0.01$、$r = 0.1$，代价给出 $K = [2.79, 2.38]$。') },
        { type: 'callout', kind: 'warning', title: t('Linear means it scales', '线性就意味着会按比例放大'), body: t(
          'Double the distance and every push doubles. The controller has no idea that the motor stops at 1 m/s². Nothing in $J$ says so, and a price cannot say so for every possible start. This is what M4 fixes.',
          '距离加倍，每一下推力也加倍。控制器根本不知道电机到 1 m/s² 就推不动了。$J$ 里没有任何地方说明这一点，而一个价格也不可能对所有可能的起点都把这件事说清楚。M4 解决的正是这个问题。') },
      ],
    },
    // ------------------------------------------------------------------ horizon and LQR
    {
      id: 'horizon-predict', kind: 'checkpoint', chapter: t('How far to look', '往前看多远'), title: t('Guess first', '先猜一猜'), skill: 'riccati-lqr', purpose: 'predict',
      prompt: t(
        'M1’s docking cost ($q_v = 0$, $r = 0.1$), no limits. With an endless horizon the gain is $K_{\\mathrm{LQR}} = [2.79, 2.36]$. Now the planner looks only $N = 5$ steps (0.5 s) ahead, with terminal weight $P = Q$. Is its gain $K_5$ bigger or smaller?',
        'M1 的停靠代价（$q_v = 0$，$r = 0.1$），没有约束。时域无限长时，增益是 $K_{\\mathrm{LQR}} = [2.79, 2.36]$。现在规划器只往前看 $N = 5$ 步（0.5 秒），终端权重 $P = Q$。它的增益 $K_5$ 是更大还是更小？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Bigger: with less time it has to hurry', '更大：时间少，得赶紧'), misconception: 'short-horizon-aggressive' },
        { id: 'b', label: t('Smaller', '更小'), correct: true },
        { id: 'c', label: t('The same: the weights decide the gain', '一样：增益由权重决定'), misconception: 'horizon-irrelevant' },
      ] },
      explain: t(
        '$K_5 = [1.17, 0.44]$. In 0.5 s no push gets the cart far, so pushing hard is mostly paid-for effort and the plan pushes gently; and it barely brakes, because the speed it builds up is only charged inside the window. Simulated from 6 m away, it swings 3.4 m past the flag.',
        '$K_5 = [1.17, 0.44]$。0.5 秒里，再怎么推小车也走不远，猛推基本就是白付用力的钱，所以计划推得很轻；它也几乎不刹车，因为攒下的速度只在窗口里计价。从 6 m 外模拟，它会冲过旗子 3.4 m。'),
    },
    {
      id: 'gain-horizon', kind: 'scene', title: t('The gain against the horizon', '增益随时域的变化'), scene: vis('mpc_gain_horizon'),
      narration: t(
        'Each point is the gain of an MPC without limits, as the horizon grows. § With the terminal weight equal to Q, the blue curves start small: a short plan does not see far enough to bother. They climb with N and § settle on the black line, the gain of an endless horizon, called LQR. § Now the green dots: the same MPC, but its terminal weight is the true cost of everything after the window. They sit on the black line for every horizon, even a single step.',
        '每个点都是一个没有约束的 MPC 的增益，时域一点点变长。§终端权重等于 Q 时，蓝色曲线一开始很小：短计划看得不够远，懒得用力。随着 N 变大，它们往上爬，§最后停在黑线上，那是时域无限长时的增益，叫 LQR。§再看绿色的点：同样的 MPC，只是终端权重换成了窗口之后所有代价的真实值。不管时域多长，哪怕只有一步，它们都正好落在黑线上。'),
    },
    {
      id: 'riccati', kind: 'derive', title: t('Solving backwards: Riccati', '倒着解：Riccati 递推'), skill: 'riccati-lqr',
      intro: t('Why do the green dots sit on the line? Solve the plan backwards, one step at a time, counting $j$ = the number of steps still to go.', '绿点为什么落在线上？把计划倒着解，一次一步，用 $j$ 表示还剩几步。'),
      lines: [
        { tex: 'P_0 = P', why: t('With no steps left, all that remains is the terminal cost $x^\\top P x$.', '一步都不剩时，剩下的只有终端代价 $x^\\top P x$。') },
        { tex: 'K_{j+1} = (R + B^\\top P_j B)^{-1} B^\\top P_j A', why: t('With one more step to go, choose $u$ to minimize $u^\\top R u + (Ax + Bu)^\\top P_j (Ax + Bu)$: the same "bottom of a bowl" as before, now with a small matrix.', '多剩一步时，选 $u$ 让 $u^\\top R u + (Ax + Bu)^\\top P_j (Ax + Bu)$ 最小：和前面一样是"找碗底"，只是换成了一个小矩阵。') },
        { tex: 'P_{j+1} = Q + A^\\top P_j\\, (A - B K_{j+1})', why: t('The best cost from here with $j + 1$ steps to go is again a quadratic $x^\\top P_{j+1} x$, so the step repeats.', '还剩 $j + 1$ 步时，从这里出发的最小代价仍然是一个二次型 $x^\\top P_{j+1} x$，所以这一步可以一直重复。') },
        { tex: 'K_N = \\begin{bmatrix} I_m & 0 & \\cdots & 0 \\end{bmatrix} H^{-1} F', why: t('After $N$ backward steps, the gain for "now" is exactly the condensed solution, computed with $n \\times n$ matrices instead of one $Nm \\times Nm$ solve (checked in our code).', '倒推 $N$ 步之后，"现在"的增益恰好就是前面压缩形式的解，只是用 $n \\times n$ 的小矩阵算，而不是解一个 $Nm \\times Nm$ 的大方程（已在我们的代码里核对）。') },
        { tex: 'N \\to \\infty: \\quad P_\\infty = Q + A^\\top P_\\infty A - A^\\top P_\\infty B\\, (R + B^\\top P_\\infty B)^{-1} B^\\top P_\\infty A', why: t('The recursion settles on a fixed point, the discrete algebraic Riccati equation (DARE). Its gain is LQR, the linear quadratic regulator (Rawlings, Mayne & Diehl, §1.3.3–1.3.6).', '递推会停在一个不动点上，也就是离散代数 Riccati 方程（DARE）。它给出的增益就是 LQR，线性二次调节器（Rawlings、Mayne、Diehl，§1.3.3–1.3.6）。') },
        { tex: 'P = P_\\infty \\ \\Rightarrow\\ P_j = P_\\infty, \\ K_j = K_{\\mathrm{LQR}} \\ \\ \\forall j', why: t('Start the recursion at the fixed point and it never moves. A terminal cost that prices the tail exactly makes every horizon act like an endless one.', '从不动点出发，递推就一动不动。终端代价把窗口之后的部分定价得刚刚好，任何时域都和无限时域一样。') },
      ],
      outro: t(
        'With $P = Q$ the plan thinks the world ends after $N$ steps. That made $K_5$ weak; in other systems it can even make the closed loop unstable (Rawlings, Mayne & Diehl, §1.3.4). Choosing $P$ well is M6.',
        '取 $P = Q$ 时，计划以为世界在 $N$ 步之后就结束了。这让 $K_5$ 很弱；在别的系统里，甚至会让闭环不稳定（Rawlings、Mayne、Diehl，§1.3.4）。怎样选好 $P$，是 M6 的内容。'),
    },
    {
      id: 'code', kind: 'code', title: t('Both ways, in twenty lines', '两种算法，二十行代码'),
      intro: t('The condensed formula $K_N$ = first rows of $H^{-1}F$, and LQR from the DARE, for M1’s docking cost.', '压缩形式的公式（$K_N$ = $H^{-1}F$ 的前几行），以及由 DARE 得到的 LQR，用的是 M1 的停靠代价。'),
      lang: 'python', code: GAIN_CODE,
      notes: [
        { lines: [3, 5], text: t('The cart of M2 (exact zero-order hold) and M1’s docking cost: $Q = \\mathrm{diag}(1, 0)$, $R = 0.1$.', 'M2 的小车（精确零阶保持）和 M1 的停靠代价：$Q = \\mathrm{diag}(1, 0)$，$R = 0.1$。') },
        { lines: [8, 12], text: t('$\\Phi$ and $\\Gamma$ from M2: row block $k$ predicts $x_{k+1}$.', 'M2 里的 $\\Phi$ 和 $\\Gamma$：第 $k$ 个行块预测的是 $x_{k+1}$。'), shapes: 'Phi: [n·N, n]  Gam: [n·N, m·N]' },
        { lines: [13, 14], text: t('The stacked weights, with $P$ as the last block, then $H$ and $F$ exactly as derived.', '叠起来的权重，最后一块是 $P$；然后按推导写出 $H$ 和 $F$。'), shapes: 'H: [m·N, m·N]  F: [m·N, n]' },
        { lines: [15, 15], text: t('Solve rather than invert, and keep the first $m$ rows: the gain applied now.', '用 solve 而不是求逆，只留前 $m$ 行：现在要用的增益。'), shapes: 'K: [m, n]' },
        { lines: [16, 17], text: t('scipy solves the DARE; one more line gives the LQR gain.', 'scipy 解 DARE；再多一行就得到 LQR 增益。') },
        { lines: [18, 21], text: t('The output: short horizon weak, longer close to LQR, and a one-step plan with $P = P_\\infty$ exactly LQR.', '输出：短时域偏弱，长一点就接近 LQR；一步的计划配上 $P = P_\\infty$，恰好等于 LQR。') },
      ],
    },
    {
      id: 'choose', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('LQR or MPC?', 'LQR 还是 MPC？'),
      blocks: [
        { type: 'p', text: t(
          'Without limits, an MPC with a long horizon, or with $P = P_\\infty$, **is** LQR. It is the same gain, and LQR needs no solver at all: Riccati once, offline, then one matrix multiply per sample. What MPC adds is constraints. In the textbook’s words, they are "the main feature" that sets MPC apart from standard LQ control[^rmd2].',
          '没有约束时，时域足够长（或者取 $P = P_\\infty$）的 MPC **就是** LQR。增益完全一样，而 LQR 根本不需要求解器：离线解一次 Riccati，之后每个采样时刻做一次矩阵乘法。MPC 多出来的是约束。用教科书的话说，约束是 MPC 区别于标准 LQ 控制的"主要特征"[^rmd2]。') },
        { type: 'table', head: [t('Your situation', '你的情况'), t('Use', '用什么'), t('Why', '为什么')], rows: [
          [t('Limits are never reached in normal operation', '正常运行时根本碰不到限制'), t('LQR (tune Q and R)', 'LQR（调 Q 和 R）'), t('Same answer as MPC, no online optimization', '答案和 MPC 一样，不用在线优化')],
          [t('Limits bind sometimes (big steps, actuators at their maximum)', '有时会碰到限制（大的阶跃、执行器顶到上限）'), t('MPC with $P = P_\\infty$ plus the constraints (M4)', 'MPC，$P = P_\\infty$，再加上约束（M4）'), t('Uses the limit fully and only when needed; LQR away from the limits', '只在需要时把限制用满；远离限制时就是 LQR')],
          [t('You hoped to avoid the limits by raising R', '想靠调大 R 来避开限制'), t('Usually not', '通常不行'), t('Slow everywhere: 11 s instead of 4.9 s in this lesson’s world', '处处都慢：本课的例子里是 11 秒，而不是 4.9 秒')],
        ] },
        { type: 'p', text: t(
          'Clipping the LQR command at the limit is the cheap alternative, and it is not optimal: the gain was computed as if the push would be delivered. With the LQR cost-to-go as the terminal cost and a long enough horizon, MPC gives the true constrained infinite-horizon optimum from a given start, so it is "LQR plus constraints"[^rmd2].',
          '把 LQR 的指令在上限处截断，是便宜的替代办法，但它不是最优的：增益是按"推力会全部兑现"算出来的。用 LQR 的剩余代价做终端代价，时域又足够长时，MPC 对给定的起点给出真正的带约束无限时域最优解，所以它就是"LQR 加上约束"[^rmd2]。') },
        { type: 'callout', kind: 'note', title: t('Rule of thumb', '经验法则'), body: t(
          'Weights say what you prefer; constraints say what is impossible. Tune $Q$ and $R$ for the behaviour you want away from the limits, then write the limits as constraints. Do not turn up $R$ to fake a limit.',
          '权重说的是你更想要什么；约束说的是什么做不到。先调 $Q$ 和 $R$，让远离限制时的表现是你想要的，再把限制写成约束。别靠调大 $R$ 去假装有一个上限。') },
        { type: 'cite', key: 'rmd2', text: t('Rawlings, Mayne & Diehl (2020). Model Predictive Control, 2nd ed., §1.3.1 and §2.11 (citing Scokaert & Rawlings, 1998).', 'Rawlings、Mayne、Diehl（2020）。Model Predictive Control，第 2 版，§1.3.1 与 §2.11（引用 Scokaert & Rawlings，1998）。'), url: 'https://sites.engineering.ucsb.edu/~jbraw/mpc/MPC-book-2nd-edition-6th-printing.pdf' },
      ],
    },
    // ------------------------------------------------------------------ checks
    {
      id: 'q-ratio', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('Double everything', '全部翻倍'), skill: 'cost-terms', purpose: 'check',
      prompt: t('A colleague doubles both $Q$ and $R$ "to make the controller try twice as hard". What happens to the gain $K$?', '同事把 $Q$ 和 $R$ 同时翻倍，说"让控制器加倍努力"。增益 $K$ 会怎样？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('It doubles', '翻倍'), misconception: 'weights-absolute' },
        { id: 'b', label: t('Nothing: the same gain', '不变：增益完全一样'), correct: true },
        { id: 'c', label: t('It halves', '减半'), misconception: 'weights-absolute' },
        { id: 'd', label: t('It grows by $\\sqrt 2$', '变成 $\\sqrt 2$ 倍'), misconception: 'weights-absolute' },
      ] },
      explain: t('Every plan’s cost doubles, so the cheapest plan is the same plan. Only ratios between the weights matter.', '每个计划的代价都翻倍，最便宜的还是同一个计划。只有权重之间的比例有意义。'),
    },
    {
      id: 'q-push', kind: 'checkpoint', title: t('A different start', '换一个起点'), skill: 'unconstrained-solution', purpose: 'check',
      prompt: t(
        'Same weights as the tuning world’s start, so $K = [2.786, 2.377]$ and $a = -k_p (p - 6) - k_v v$. The cart is at $p = 4$ m and rolling **away** from the flag at $v = -1$ m/s. What is the first push $a_0$?',
        '权重和调参世界的起始设置一样，所以 $K = [2.786, 2.377]$，$a = -k_p (p - 6) - k_v v$。小车在 $p = 4$ m 处，正以 $v = -1$ m/s 的速度**背离**旗子滑动。第一下推力 $a_0$ 是多少？'),
      question: { type: 'number', answer: 7.949, tolerance: 0.1, unit: 'm/s²', wrong: [
        { answer: 16.716, misconception: 'gain-fixed-push', feedback: t('That is the push from the earlier start. The push is not a property of the controller: it is $K$ times this state.', '这是之前那个起点的推力。推力不是控制器固定的属性：它是 $K$ 乘以这个状态。') },
        { answer: 5.572, feedback: t('That is only the distance term. The speed term adds: it is moving the wrong way, so the controller pushes harder.', '这只算了距离那一项。速度那一项也要加上：它在往反方向走，所以控制器推得更猛。') },
        { answer: 3.195, feedback: t('Check the sign of the speed term: $-k_v v$ with $v = -1$ is $+2.377$.', '检查速度项的符号：$v = -1$ 时，$-k_v v$ 等于 $+2.377$。') },
      ] },
      explain: t('$a_0 = -2.786 \\times (4 - 6) - 2.377 \\times (-1) = 5.572 + 2.377 \\approx 7.95$ m/s².', '$a_0 = -2.786 \\times (4 - 6) - 2.377 \\times (-1) = 5.572 + 2.377 \\approx 7.95$ m/s²。'),
    },
    {
      id: 'q-terminal', kind: 'checkpoint', title: t('A short horizon', '时域很短'), skill: 'riccati-lqr', purpose: 'check',
      prompt: t(
        'Your MPC must run with $N = 3$ (the processor is slow) and uses $P = Q$. It is weak and swings around the flag for a long time. Without making $N$ longer, what is the best fix?',
        '你的 MPC 只能用 $N = 3$（处理器太慢），终端权重是 $P = Q$。它推得太弱，绕着旗子来回晃了很久。不加长 $N$，最好的修法是什么？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Set $P$ to the DARE solution $P_\\infty$', '把 $P$ 设成 DARE 的解 $P_\\infty$'), correct: true },
        { id: 'b', label: t('Multiply $Q$ by 10', '把 $Q$ 乘以 10'), misconception: 'horizon-irrelevant', feedback: t('That changes what you asked for, and the 3-step plan still cannot see the tail: in simulation it still swings 3 m past the flag, now pushing at 24 m/s².', '这改变了你提的要求，而且 3 步的计划仍然看不到窗口之后的部分：模拟里它还是会冲过旗子 3 m，而且推力到了 24 m/s²。') },
        { id: 'c', label: t('Add the constraint $|a| \\le 1$', '加上约束 $|a| \\le 1$'), misconception: 'mpc-always', feedback: t('A constraint only cuts pushes off; it cannot make a weak gain stronger.', '约束只会把推力截掉；它没法让一个太弱的增益变强。') },
        { id: 'd', label: t('Nothing helps; 3 steps is too short', '没救；3 步太短了') },
      ] },
      explain: t('With $P = P_\\infty$ the tail after step 3 is priced exactly, and the gain is the LQR gain for any $N$, even $N = 1$.', '取 $P = P_\\infty$，第 3 步之后的部分就被定价得刚刚好，不管 $N$ 是多少（哪怕 $N = 1$），增益都等于 LQR 增益。'),
    },
    {
      id: 'q-explain', kind: 'checkpoint', title: t('Explain it', '解释一下'), skill: 'lqr-or-mpc', purpose: 'check',
      prompt: t(
        'A colleague says: "Just make R big enough that the motor never saturates. Then we never need MPC." In two or three sentences, what is wrong with this, and when is it actually fine?',
        '同事说："只要把 R 调得足够大，电机就永远不会饱和，那我们就永远用不着 MPC。"用两三句话说说这有什么问题，以及什么时候这样做其实没问题。'),
      question: { type: 'text', placeholder: t('R is a price, so…', 'R 是价格，所以……'), rubric: {
        key_points: [
          t('R is a price, not a limit: the push still grows with the error, so it only stays within the limit for the starts you tuned for.', 'R 是价格，不是上限：推力仍然随偏差变大，所以只有在调参时考虑过的那些起点上，才能保证不超限。'),
          t('Keeping every push small makes the controller slow everywhere (in the lesson 11 s instead of the 4.9 s the motor allows).', '让每一下推力都很小，控制器就处处都慢（课里的例子是 11 秒，而电机允许 4.9 秒）。'),
          t('A constraint acts only when the limit is reached; if the limits never bind in practice, LQR is fine.', '约束只在碰到上限时才起作用；如果实际中从来碰不到限制，用 LQR 就行。'),
        ],
        model_answer: t(
          'R only puts a price on effort; the push is still K times the error, so a bigger start pushes harder and can saturate anyway. Making R big enough for every start makes the controller slow all the time, here 11 s instead of 4.9 s. MPC with the limit as a constraint pushes to the limit only when it must and is LQR otherwise; if the limits never bind in practice, plain LQR is the right choice.',
          'R 只是给用力定了个价；推力仍然是 K 乘以偏差，起点远一点就推得更猛，照样可能饱和。要让 R 对所有起点都够大，控制器就一直很慢，这里是 11 秒而不是 4.9 秒。把上限写成约束的 MPC 只在不得不时推到上限，其余时候就是 LQR；如果实际中从来碰不到限制，直接用 LQR 才是对的。'),
        min_points: 2,
      } },
    },
  ],
};
