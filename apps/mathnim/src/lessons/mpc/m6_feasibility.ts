// M6 Stability and feasibility: the price of short sight. Why a short-horizon
// MPC hits the wall although every QP it solved had a solution (the trap), what
// the end of the plan must promise (terminal set: recursive feasibility;
// terminal cost: decrease, stability), what that costs (the region of
// attraction), soft constraints when a hard limit cannot be kept, and what
// industry does instead. Design: checkpoints/m6.md; sources: research-m6.md.
// Every number about the cart is a simulation of the course's toy model
// (packages/visuals/src/mpc/terminal_math.test.ts).
import type { Lesson } from '@mathnim/core';
import { TERMINAL_LABELS, type TerminalResult } from '@mathnim/visuals/mpc';
import { attach, t, vis } from './common';

const CODE = `import numpy as np
import cvxpy as cp

dt, N = 0.1, 5                              # a short look-ahead: 0.5 s
A = np.array([[1, dt], [0, 1]])
B = np.array([[dt**2 / 2], [dt]])
a_max, v_max, wall = 1.0, 2.0, 10.0
c = v_max / a_max - dt / 2                  # 1.95 s: edge of the terminal set

x0 = cp.Parameter(2)                        # the measured state, set every sample
X = cp.Variable((2, N + 1))
U = cp.Variable((1, N))
s = cp.Variable(N, nonneg=True)             # slack on the speed limit
cost = (cp.sum_squares(X[0, 1:] - wall) + 0.1 * cp.sum_squares(U)
        + 1000 * cp.sum(s) + cp.sum_squares(s))      # l1 = 1000, l2 = 1
limits = [X[:, 0] == x0,
          X[:, 1:] == A @ X[:, :-1] + B @ U,
          cp.abs(U) <= a_max,
          X[1, 1:] <= v_max + s,            # soft: may be broken, at a price
          X[1, 1:] >= -v_max,
          X[0, 1:] <= wall,                 # hard: the wall is not negotiable
          X[0, N] + c * X[1, N] <= wall]    # terminal set: still able to stop
problem = cp.Problem(cp.Minimize(cost), limits)

x = np.array([0.0, 0.0])
v_top = slack_top = 0.0
for k in range(200):
    x0.value = x
    problem.solve()
    if problem.status != cp.OPTIMAL:        # X_f and the soft limit keep this from happening
        raise RuntimeError(f"no plan at t = {k * dt:.1f} s")
    a = U.value[0, 0]
    slack_top = max(slack_top, s.value.max())
    x = A @ x + B[:, 0] * a
    if k + 1 == 30:
        x[1] += 0.4                         # a gust at t = 3 s
    v_top = max(v_top, x[1])
    if abs(x[0] - wall) < 5e-3 and abs(x[1]) < 5e-3:
        print(f"docked at t = {(k + 1) * dt:.1f} s")
        break
print(f"top speed {v_top:.2f} m/s, largest slack {slack_top:.2f}")
# docked at t = 12.0 s
# top speed 2.40 m/s, largest slack 0.30`;

const RMD = (sec: string) => ({
  type: 'cite' as const, key: 'rmd',
  text: t(`Rawlings, Mayne & Diehl (2020). Model Predictive Control: Theory, Computation, and Design, 2nd ed., ${sec}. Free PDF.`, `Rawlings、Mayne、Diehl（2020）。Model Predictive Control: Theory, Computation, and Design，第 2 版，${sec}。免费 PDF。`),
  url: 'https://sites.engineering.ucsb.edu/~jbraw/mpc/MPC-book-2nd-edition-6th-printing.pdf',
});
const MAYNE = { type: 'cite' as const, key: 'mayne', text: t('Mayne, Rawlings, Rao & Scokaert (2000). Constrained model predictive control: Stability and optimality. Automatica 36(6), 789–814.', 'Mayne、Rawlings、Rao、Scokaert（2000）。Constrained model predictive control: Stability and optimality。Automatica 36(6)，789–814。'), url: 'https://doi.org/10.1016/S0005-1098(99)00214-9' };
const QIN = { type: 'cite' as const, key: 'qin', text: t('Qin & Badgwell (2003). A survey of industrial model predictive control technology. Control Engineering Practice 11(7), 733–764.', 'Qin、Badgwell（2003）。A survey of industrial model predictive control technology。Control Engineering Practice 11(7)，733–764。'), url: 'https://doi.org/10.1016/S0967-0661(02)00186-7' };

const last = (w: { state: Record<string, unknown> }) => w.state.last as TerminalResult | undefined;
const released = (e: { type: string; data?: Record<string, unknown> }) => (e.type === 'released' ? (e.data as unknown as TerminalResult) : undefined);

export const lesson: Lesson = {
  id: 'mpc-m6-feasibility',
  title: t('Stability and feasibility: the price of short sight', '稳定与可行：短视的代价'),
  description: t(
    'Why a short-horizon MPC can crash although every optimisation it solved had an answer, what the end of the plan must promise so that it never runs out of plans, and what soft constraints do when a limit cannot be kept.',
    '为什么时域短的 MPC 每一次优化都有解，最后却还是撞墙；计划的结尾要做出什么承诺，才能保证永远有计划可用；以及限制守不住时，软约束做了什么。'),
  mode: 'essay',
  skills: [
    { id: 'trap', name: t('Why a feasible QP can still lead to a crash', '为什么 QP 有解，最后仍可能撞'), },
    { id: 'terminal-set', name: t('What a terminal set is and how to build one', '终端集是什么，怎样构造'), prerequisites: ['trap'] },
    { id: 'recursive-feasibility', name: t('Recursive feasibility: the shift argument', '递归可行性：平移论证'), prerequisites: ['terminal-set'] },
    { id: 'terminal-cost', name: t('Terminal cost and the cost decrease (stability)', '终端代价与代价下降（稳定性）'), prerequisites: ['recursive-feasibility'] },
    { id: 'soft-constraints', name: t('Soft constraints and the slack price', '软约束与松弛的价格') },
  ],
  misconceptions: [
    { id: 'feasible-now-safe', description: t('If the QP has a solution now, the cart is safe.', '只要现在 QP 有解，小车就是安全的。') },
    { id: 'terminal-cost-enough', description: t('A good terminal cost (the LQR P) is enough to make a short horizon safe.', '有一个好的终端代价（LQR 的 P），短时域就安全了。') },
    { id: 'longer-n-guarantee', description: t('If a longer N docks in simulation, it is guaranteed to work.', '长一点的 N 在仿真里停稳了，就等于有保证。') },
    { id: 'stricter-terminal-safer', description: t('The stricter the terminal constraint, the safer the controller.', '终端约束越严，控制器越安全。') },
    { id: 'slack-any-price', description: t('Any slack price turns a hard limit into a safe soft one.', '松弛的价格随便取，都能把硬约束变成安全的软约束。') },
    { id: 'soften-everything', description: t('To avoid infeasibility, soften every constraint, the wall included.', '为了不出现无解，把所有约束都软化，包括墙。') },
  ],
  steps: [
    // ------------------------------------------------------------------ the problem
    {
      id: 'why', kind: 'read', chapter: t('The problem', '问题'), title: t('Every QP had an answer, and it still crashed', '每个 QP 都有解，它还是撞了'),
      blocks: [
        { type: 'p', text: t(
          'In M1 the docking MPC with a look-ahead of 5 steps (0.5 s) hit the wall at 1.55 m/s. Look at its log and something odd shows up: from t = 0 to t = 5.5 s, **every** QP it solved had a solution. Each plan kept the speed limit and stayed off the wall inside its window. Only at 5.6 s, half a second before the impact, did the solver report "no plan", and by then nothing could help.',
          'M1 里，预测时域只有 5 步（0.5 秒）的停靠 MPC 以 1.55 m/s 撞了墙。翻一翻它的记录，会发现一件怪事：从 t = 0 到 t = 5.5 秒，它解的**每一个** QP 都有解。每份计划在自己的窗口里都守住了限速，也没碰墙。直到 5.6 秒，离撞墙只剩半秒，求解器才报"无解"，而那时已经什么都救不回来了。') },
        { type: 'p', text: t(
          'So "the QP has a solution now" is not the promise we need. We want two stronger ones:',
          '所以"现在 QP 有解"并不是我们需要的那个承诺。我们要的是两个更强的承诺：') },
        { type: 'list', items: [
          t('**Recursive feasibility:** if the QP has a solution now, it will have one at the next sample too, and so forever. The controller never runs out of plans.', '**递归可行性：** 只要现在 QP 有解，下一个采样时刻也一定有解，于是永远有解。控制器永远不会"没有计划可用"。'),
          t('**Stability:** the closed loop actually gets to the target and stays there, instead of circling, creeping or oscillating.', '**稳定性：** 闭环真的会到达目标并停在那里，而不是绕圈、蹭着走或者来回振荡。'),
        ] },
        { type: 'p', text: t(
          'A finite horizon gives neither for free. This lesson shows where the gap is, then closes it with two additions at the **end** of the plan: a terminal set and a terminal cost. First, watch the crash in a picture where it can be seen coming.',
          '有限的时域，这两样都不会白送。这节课先找到漏洞在哪，然后在计划的**末端**加两样东西把它补上：终端集和终端代价。先看撞墙的过程，换一张能"提前看见"它的图。') },
      ],
    },
    {
      id: 'trap-scene', kind: 'scene', title: t('The trap', '陷阱'), scene: vis('mpc_terminal_world', { story: 'trap', N: 5, mode: 'none' }),
      narration: t(
        'Each dot is the cart’s state, position across and speed up, one every tenth of a second. Right of the coral curve, a crash is certain: even full brakes need more room than is left. The cart crosses that curve at five point one seconds, but its short plans still find a way to stay off the wall inside their half-second window. That dark strip is the trap: the problem still has a solution, the crash is already certain. Half a second later the solver finally gives up, and the cart hits the wall.',
        '每个点是小车某一刻的状态：横轴是位置，纵轴是速度，每 0.1 秒一个。珊瑚色曲线右边，撞墙已成定局：就算全力刹车，需要的距离也比剩下的多。小车在 5.1 秒越过了这条线，可它的短计划在半秒的窗口里，仍然找得到不碰墙的走法。那条深色的窄带就是陷阱：问题还有解，撞墙却已经注定。又过了半秒，求解器才终于放弃，小车撞上了墙。'),
    },
    {
      id: 'trap', kind: 'derive', title: t('When does a trap exist?', '陷阱什么时候存在？'), skill: 'trap',
      intro: t('Compare the room a full stop needs with what a window of length $T = N\\Delta t$ can see. Braking at $a$ from speed $v$:', '比较一下：全力刹停需要多少距离，长度为 $T = N\\Delta t$ 的窗口又能看到多少。以减速度 $a$ 从速度 $v$ 刹车：'),
      lines: [
        { tex: 'd_s = \\frac{v^2}{2a}', why: t('$d_s$ ($s$ for stop): the room a full stop really needs. If $p + d_s$ is past the wall, the crash is certain: the light coral region.', '$d_s$（s 代表刹停）：真正刹停需要的距离。如果 $p + d_s$ 已经越过墙，撞墙就是注定的：浅珊瑚色区域。') },
        { tex: 'd_T = vT - \\tfrac12 a T^2 \\quad (T < v/a)', why: t('$d_T$: how far the cart still travels inside the window of length $T$ while braking fully. This is all a plan of length $T$ checks: it only has to keep $p$ off the wall up to time $T$.', '$d_T$：全力刹车时，小车在长度为 $T$ 的窗口内还会走多远。长度为 $T$ 的计划只检查这么多：它只需保证到时刻 $T$ 为止 $p$ 不碰墙。') },
        { tex: 'd_s - d_T = \\frac{(v - aT)^2}{2a} > 0', why: t('The gap: the window sees a shorter stopping distance than the real one whenever $T < v/a$. Every state with $p$ inside this gap is in the trap: a plan exists, a crash is certain.', '差值：只要 $T < v/a$，窗口看到的刹车距离就比真实的短。$p$ 落在这段差里的状态，都在陷阱中：计划存在，撞墙注定。') },
        { tex: 'v = 2,\\ a = 1,\\ T = 0.5:\\quad \\frac{(2 - 0.5)^2}{2} = 1.125\\ \\text{m}', why: t('For M1’s 5-step plan at top speed, the trap is $p$ between 8 and 9.125 m (in the scene). It vanishes once $T$ reaches $v/a = 2$ s; in steps of 0.1 s that is $N = 19$, M1’s answer.', '对 M1 的 5 步计划、最高速度时，陷阱是 $p$ 在 8 到 9.125 米之间（就是动画里那条）。等 $T$ 达到 $v/a = 2$ 秒，它就消失了；按 0.1 秒一步算是 $N = 19$，正是 M1 的答案。') },
      ],
      blank: { line: 2, answer: '(v - a*T)^2/(2*a)', variables: ['v', 'a', 'T'], prompt: t('The gap $d_s - d_T$, in $v$, $a$ and $T$.', '用 $v$、$a$、$T$ 写出差值 $d_s - d_T$。') },
      outro: t('The window is not wrong about what it sees. It just cannot see the end of the stop, and nothing in the problem asks it to.', '窗口对它看到的部分并没有算错。它只是看不到刹停的后半段，而问题里也没有任何东西要求它去看。'),
    },
    {
      id: 'predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'trap', purpose: 'predict',
      prompt: t('Keep the look-ahead at 5 steps. Which addition to the QP lets the cart dock without ever running out of plans?', '预测时域仍然是 5 步。给 QP 加哪一样，能让小车停稳，而且从不出现"没有计划"？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('A terminal cost: price the end state with the LQR cost-to-go $P$', '终端代价：用 LQR 的剩余代价 $P$ 给末端状态定价'), misconception: 'terminal-cost-enough' },
        { id: 'b', label: t('A terminal set: the plan must end in a state from which a stop is still possible', '终端集：计划必须结束在一个还能刹停的状态'), correct: true },
        { id: 'c', label: t('End exactly at the target: $x_N = (10, 0)$', '正好停在目标上：$x_N = (10, 0)$'), misconception: 'stricter-terminal-safer' },
        { id: 'd', label: t('Nothing helps; only a longer $N$', '什么都没用，只能加长 $N$'), misconception: 'longer-n-guarantee' },
      ] },
      explain: t('Try all four in the next world. Only one of them works at $N = 5$, and one of the others never even starts.', '下一个交互里把四种都试一遍。在 $N = 5$ 时只有一种管用，另外有一种甚至根本动不起来。'),
    },
    {
      id: 'world', kind: 'explore', title: t('Make a short plan safe', '让短计划也安全'), skill: 'terminal-set',
      scene: vis('mpc_terminal_world', { story: 'plain', N: 5, mode: 'none' }),
      prompt: t(
        'Choose what the **end of the plan** must satisfy, and the look-ahead $N$. Find a setting with $N \\le 8$ (0.8 s, less than half of M1’s 1.9 s) where the cart docks and **every** QP has a solution.',
        '选择**计划的末端**要满足什么，再选预测时域 $N$。找到一个 $N \\le 8$（0.8 秒，不到 M1 的 1.9 秒的一半）的设置，让小车停稳，而且**每一个** QP 都有解。'),
      cue: [TERMINAL_LABELS.mode, TERMINAL_LABELS.N],
      setup: attach('mpc_terminal_world', { story: 'plain' }),
      goals: [
        { id: 'safe-short', check: (_s, _c, w) => { const r = last(w); return !!r && r.mode === 'set' && r.N <= 8 && !r.crashed && r.infeasible_t < 0 && r.docked_t > 0; }, message: t(
          'The terminal set: the plan may only end where a stop is still possible ($p_N + 1.95\\,v_N \\le 10$). Then no plan ever ends in the trap, every later QP has a solution, and the cart never even enters the crash-certain region. With $N = 8$ it docks at 8.3 s; shorter windows dock too, just more slowly.',
          '终端集：计划只能结束在还刹得住的地方（$p_N + 1.95\\,v_N \\le 10$）。这样就没有哪份计划会结束在陷阱里，之后每个 QP 都有解，小车连"必撞"区域都不会进。$N = 8$ 时它在 8.3 秒停稳；更短的窗口也能停稳，只是慢一些。') },
      ],
      detectors: [
        { id: 'record', on: (e, w) => { if (e.type === 'released') w.state.last = e.data; return null; } },
        { id: 'cost-crash', on: (e) => {
          const r = released(e);
          return r && r.mode === 'cost' && r.crashed ? { kind: 'misconception', id: 'terminal-cost-enough', message: t(
            'The LQR cost-to-go makes the end of the plan expensive, but it assumes unlimited brakes, so it believes the cart can always stop in time. It changes which plan is chosen, not which plans exist: the trap is the same, and the cart still hits.',
            'LQR 的剩余代价让计划末端变"贵"了，但它假设刹车不受限，以为小车总能及时停住。它改变的是选哪份计划，而不是有哪些计划可选：陷阱还是那条，小车照样撞墙。') } : null;
        } },
        { id: 'long-n', on: (e) => {
          const r = released(e);
          return r && (r.mode === 'none' || r.mode === 'cost') && !r.crashed && r.N >= 19 ? { kind: 'misconception', id: 'longer-n-guarantee', message: t(
            'It docks, for this start, these brakes and this top speed. Nothing in the QP promises it: with brakes of 0.8 m/s², a 2 s look-ahead hits the wall at 0.45 m/s (M1). The terminal set carries its own proof.',
            '它停稳了，但只是对这个起点、这样的刹车和最高速度而言。QP 里没有任何东西保证这一点：刹车换成 0.8 m/s²，2 秒的预测时域就会以 0.45 m/s 撞墙（M1）。终端集则自带证明。') } : null;
        } },
        { id: 'end-stuck', on: (e) => {
          const r = released(e);
          return r && r.mode === 'end' && !r.started ? { kind: 'misconception', id: 'stricter-terminal-safer', message: t(
            'Safe, and useless: from rest at 0 m, no plan of this length reaches the wall and stops there (that takes 7 s), so the QP has no solution and the cart never moves. A stricter end shrinks the set of states where the controller works.',
            '安全，但没用：从 0 米处静止出发，这么短的计划不可能到墙边并停住（那至少要 7 秒），所以 QP 无解，小车一动不动。末端要求越严，控制器能工作的状态就越少。') } : null;
        } },
        { id: 'set-long', on: (e) => {
          const r = released(e);
          return r && r.mode === 'set' && r.N > 8 ? { kind: 'progress', id: 'set-long' } : null;
        } },
      ],
      lines: [
        { text: t('Dots are the cart’s states, one every tenth of a second. Coral dots mean the solver found no plan. Watch the dark strip: that is the trap.', '每个点是小车某一刻的状态，0.1 秒一个。珊瑚色的点表示求解器找不到计划。注意那条深色的窄带：那就是陷阱。'), when: 'enter' },
        { text: t('Change what the end of the plan must satisfy, then compare the dark strip and the dots.', '换一换计划末端的要求，再对比深色窄带和那些点。'), when: 'idle' },
        { text: t('Same trap, same crash. A price on the end state does not stop the plan from ending in the trap.', '陷阱还在，照样撞墙。给末端状态定价，挡不住计划结束在陷阱里。'), when: { finding: 'terminal-cost-enough' } },
        { text: t('Long enough works here, but only because this cart and these brakes happen to allow it.', '时域够长在这里管用，但只是因为这辆车、这样的刹车恰好允许。'), when: { finding: 'longer-n-guarantee' } },
        { text: t('It never moves. Ending exactly at the target is too strict for a short plan.', '它一动不动。要求正好停在目标上，对短计划来说太严了。'), when: { finding: 'stricter-terminal-safer' } },
        { text: t('That works. Now make the window shorter: does it still hold?', '这样可以。再把窗口缩短一点：还成立吗？'), when: { finding: 'set-long' } },
        { text: t('A short plan is safe if it must end where a stop is still possible. Next: why that promise carries over from one sample to the next.', '只要短计划必须结束在还能刹停的地方，它就安全。接下来看：为什么这个承诺能从一个采样时刻传到下一个。'), when: 'goal' },
      ],
      solve: (s: any, _c, w) => {
        s.m.set_value(2);
        s.N.set_value(8);
        w.emit('released', s.result());
      },
    },
    // ------------------------------------------------------------------ the terminal set
    {
      id: 'terminal-set', kind: 'read', chapter: t('The terminal set', '终端集'), title: t('End where a stop is still possible', '结束在还能刹停的地方'),
      blocks: [
        { type: 'p', text: t(
          'The trap exists because the plan’s last state $x_N$ may be anything the limits allow, including "at 9 m, still at 2 m/s". The fix is a condition on $x_N$: it must lie in a **terminal set** $\\mathcal X_f$, a set of states from which some simple controller, the *terminal controller* $\\kappa_f$, can keep every limit forever. For the cart, $\\kappa_f$ is "brake to rest", and $\\mathcal X_f$ is every state from which braking stops the cart before the wall:',
          '陷阱之所以存在，是因为计划的最后一个状态 $x_N$ 只要满足那几条限制就行，包括"在 9 米处，速度还是 2 m/s"。补法是给 $x_N$ 加一个条件：它必须落在**终端集** $\\mathcal X_f$ 里。终端集是这样一组状态：从其中任何一点出发，某个简单的控制器（*终端控制器* $\\kappa_f$）能让所有限制永远成立。对小车来说，$\\kappa_f$ 就是"刹车直到停下"，$\\mathcal X_f$ 就是所有"刹车能在墙前停住"的状态：') },
        { type: 'math', tex: '\\mathcal X_f = \\{\\, (p, v) :\\ p + c\\,v \\le 10,\\ \\ p \\le 10,\\ \\ |v| \\le 2 \\,\\}, \\qquad c = \\frac{v_{\\max}}{a_{\\max}} - \\frac{\\Delta t}{2} = 1.95\\ \\text{s}' },
        { type: 'list', items: [
          t('$p + c\\,v \\le 10$: a straight line under the curved stopping boundary $p + v^2/2 = 10$, touching it where it matters (at rest at the wall). A straight line keeps the QP a QP; the exact curve would not be linear.', '$p + c\\,v \\le 10$：一条直线，位于弯曲的刹停边界 $p + v^2/2 = 10$ 之内，并在关键的地方（墙边静止）和它相接。用直线，QP 仍是 QP；精确的曲线就不是线性约束了。'),
          t('Why $c = 1.95$ and not 2: in one sample of braking at 2 m/s, $p$ grows by $0.2 - 0.005$ and $v$ drops by 0.1. With $c = 1.95$, $p + c\\,v$ changes by $0.1\\,v - 0.2 \\le 0$, so braking never leaves the set. With $c = 2$ the edge would be overshot by 5 mm per sample.', '为什么 $c = 1.95$ 而不是 2：以 2 m/s 刹车一个采样周期，$p$ 增加 $0.2 - 0.005$，$v$ 减少 0.1。取 $c = 1.95$ 时，$p + c\\,v$ 的变化是 $0.1\\,v - 0.2 \\le 0$，所以刹车永远不会离开这个集合。取 $c = 2$ 的话，每个周期都会越过边界 5 毫米。'),
          t('This property has a name: $\\mathcal X_f$ is **control invariant** (RMD Def. 2.9): from every state in it, an allowed input keeps the next state in it[^rmd].', '这个性质有个名字：$\\mathcal X_f$ 是**控制不变集**（RMD 定义 2.9）：从其中任何状态出发，都有一个允许的输入让下一个状态仍然在集合里[^rmd]。'),
        ] },
        { type: 'p', text: t('Why does a condition on the **end** of the plan protect the **next** QP? The picture says it in three steps:', '为什么对计划**末端**的一个条件，就能保护**下一次**的 QP？这张图分三步说明：') },
        { type: 'visual', name: 'mpc_shift_tail', params: { N: 8 }, caption: t('The plan’s states before $x_N$ may lie outside $\\mathcal X_f$; only its end must be inside. The tail plus one braking step is a ready-made plan for the next sample.', '计划在 $x_N$ 之前的状态可以在 $\\mathcal X_f$ 之外；只有终点必须在里面。后半段加上一步刹车，就是为下一个时刻准备好的现成计划。') },
        RMD('Def. 2.9, p. 110'),
      ],
    },
    {
      id: 'feasible-proof', kind: 'derive', title: t('Recursive feasibility', '递归可行性'), skill: 'recursive-feasibility',
      intro: t('Suppose the QP at time $k$ has a solution $u_0, \\dots, u_{N-1}$ with predicted states $x_1, \\dots, x_N$, and $x_N \\in \\mathcal X_f$. The model is exact, so the cart really arrives at $x_1$.', '假设时刻 $k$ 的 QP 有解 $u_0, \\dots, u_{N-1}$，预测状态是 $x_1, \\dots, x_N$，并且 $x_N \\in \\mathcal X_f$。模型是准确的，所以小车真的到达 $x_1$。'),
      lines: [
        { tex: '\\tilde u = (u_1, \\dots, u_{N-1},\\ \\kappa_f(x_N))', why: t('A candidate for the QP at $k+1$: drop the step already applied, keep the rest, and append one step of the terminal controller (here: brake).', '给 $k+1$ 时刻 QP 的一个候选：去掉已经执行的那一步，保留其余的，末尾补上一步终端控制器的动作（这里就是刹车）。') },
        { tex: '\\tilde x = (x_2, \\dots, x_N,\\ x_{N+1}), \\qquad x_{N+1} = A x_N + B\\,\\kappa_f(x_N)', why: t('Starting from $x_1$, it reproduces the old predictions and adds one new state at the end.', '从 $x_1$ 出发，它重现了旧的预测，并在末尾多出一个新状态。') },
        { tex: 'x_2, \\dots, x_N \\in \\mathbb X, \\qquad x_{N+1} \\in \\mathcal X_f', why: t('$\\mathbb X$ is the set allowed by the limits. The old states kept the limits already. The new end is in $\\mathcal X_f$ because $\\mathcal X_f$ is control invariant under $\\kappa_f$, and $\\kappa_f$ respects $|a| \\le 1$.', '$\\mathbb X$ 是限制所允许的状态集合。旧的那些状态本来就满足限制。新的终点在 $\\mathcal X_f$ 里，因为 $\\mathcal X_f$ 在 $\\kappa_f$ 下控制不变，而且 $\\kappa_f$ 遵守 $|a| \\le 1$。') },
        { tex: '\\Rightarrow\\ \\tilde u \\in \\mathcal U_{k+1} \\neq \\varnothing, \\quad \\mathcal U_{k+2} \\neq \\varnothing, \\ \\dots', why: t('$\\mathcal U_{k+1}$ is the set of plans the QP at $k+1$ allows: it contains $\\tilde u$, so it is not empty. The solver may find a better plan than $\\tilde u$, but it cannot report "no solution". By induction, a QP that is feasible once stays feasible. Since every plan ends in $\\mathcal X_f$, no plan ends in the trap.', '$\\mathcal U_{k+1}$ 是 $k+1$ 时刻的 QP 允许的计划集合：它包含 $\\tilde u$，所以不是空集。求解器也许能找到比 $\\tilde u$ 更好的计划，但它不可能报"无解"。用归纳法，一次有解，就永远有解。而且每份计划都结束在 $\\mathcal X_f$ 里，没有哪份计划会结束在陷阱中。') },
      ],
      blank: { line: 1, answer: 'A*x_N + B*k', variables: ['A', 'x_N', 'B', 'k'], prompt: t('The appended state $x_{N+1}$, writing $k$ for $\\kappa_f(x_N)$.', '写出补上的状态 $x_{N+1}$，用 $k$ 表示 $\\kappa_f(x_N)$。') },
      outro: t('Note what this uses: an exact model and an invariant terminal set. M7 deals with the first assumption failing.', '注意这个论证用到了什么：模型准确，以及终端集不变。第一条不成立时怎么办，是 M7 的内容。'),
    },
    // ------------------------------------------------------------------ the terminal cost
    {
      id: 'cost', kind: 'read', chapter: t('The terminal cost', '终端代价'), title: t('Feasible is not the same as convergent', '可行不等于收敛'),
      blocks: [
        { type: 'p', text: t(
          'Recursive feasibility says the controller never runs out of plans. It does not say the cart ever reaches the target: a controller that brakes and waits a metre short is feasible forever. That second promise comes from the **terminal cost** $V_f(x_N) = x_N^\\top P x_N$, the price of the rest of the trip after the window.',
          '递归可行性说的是控制器永远有计划可用，但没说小车一定会到达目标：一个刹住车、在离墙一米处干等的控制器，也永远可行。第二个承诺来自**终端代价** $V_f(x_N) = x_N^\\top P x_N$，也就是窗口之后"剩下那段路"的价格。') },
        { type: 'p', text: t(
          'M3 used $P = P_\\infty$, the LQR cost-to-go: with no limits, the cost after step $N$ is then priced exactly, and every horizon gives the LQR gain. So why did the world’s "cost $P$" still crash? Because $P_\\infty$ prices the rest of the trip **as if the brakes were unlimited**. It thinks a cart at 9 m doing 2 m/s can still stop: LQR would brake at more than 1 m/s². The price is optimistic exactly where the limits bite, so it does not keep the plan out of the trap. Worse, on this cart the LQR closed loop overshoots (its eigenvalues are complex, $0.875 \\pm 0.111i$), and with the target on the wall, even from rest a few millimetres short of the target it overshoots past the wall. There is no region around the target where the LQR price is honest.',
          'M3 用过 $P = P_\\infty$，即 LQR 的剩余代价：没有限制时，第 $N$ 步之后的代价就被准确定价，任何时域都给出 LQR 增益。那为什么交互里的"终端代价"还是撞了？因为 $P_\\infty$ 给剩下那段路定价时，**假设刹车不受限**。它以为在 9 米处以 2 m/s 行驶的小车仍然停得住：LQR 会以超过 1 m/s² 的减速度刹车。偏偏在限制起作用的地方，这个价格过于乐观，所以挡不住计划落进陷阱。更糟的是，这辆车上 LQR 闭环会超调（特征值是复数，$0.875 \\pm 0.111i$），而目标就在墙上，哪怕从离目标只差几毫米的静止状态出发，它也会冲过墙。目标周围找不到一块 LQR 价格"说实话"的区域。') },
        { type: 'p', text: t(
          'The textbook design therefore uses the two **together** (RMD §2.5.4)[^rmd2]: $P$ = the LQR cost-to-go, and $\\mathcal X_f$ = a set where $u = -Kx$ keeps every limit (the maximal admissible set of Gilbert and Tan). Inside $\\mathcal X_f$ the price is exact, and the set stops the plan from ending anywhere else. These conditions were collected in the survey of Mayne et al.[^mayne]; the general one is the next derivation.',
          '所以教科书的设计把两者**一起**用（RMD §2.5.4）[^rmd2]：$P$ 取 LQR 的剩余代价，$\\mathcal X_f$ 取一个 $u = -Kx$ 能守住所有限制的集合（Gilbert 和 Tan 的最大允许集）。在 $\\mathcal X_f$ 里，价格是准确的；而这个集合又不许计划结束在别处。这些条件由 Mayne 等人的综述系统整理[^mayne]；一般的条件见下一个推导。') },
        MAYNE,
        { type: 'cite', key: 'rmd2', text: t('Rawlings, Mayne & Diehl (2020), §2.5.4, pp. 136–137; Gilbert & Tan (1991), IEEE TAC 36(9).', 'Rawlings、Mayne、Diehl（2020），§2.5.4，第 136–137 页；Gilbert、Tan（1991），IEEE TAC 36(9)。'), url: 'https://doi.org/10.1109/9.83532' },
      ],
    },
    {
      id: 'lyapunov', kind: 'derive', title: t('Why the cost keeps falling', '为什么代价一路下降'), skill: 'terminal-cost',
      intro: t('Let $J^*(x)$ be the optimal cost from state $x$, with stage cost $\\ell(x, u) = x^\\top Q x + u^\\top R u$ (measured from the target). Use the same candidate $\\tilde u$ as before.', '设 $J^*(x)$ 是从状态 $x$ 出发的最优代价，阶段代价 $\\ell(x, u) = x^\\top Q x + u^\\top R u$（从目标算起）。仍然用前面那个候选 $\\tilde u$。'),
      lines: [
        { tex: 'J(x_1, \\tilde u) = J^*(x) - \\ell(x, u_0) - V_f(x_N) + \\ell(x_N, \\kappa_f(x_N)) + V_f(x_{N+1})', why: t('The candidate pays the same stages as the old plan, minus the first one (already paid), with the old end price $V_f(x_N)$ replaced by one more stage and a new end price.', '候选计划付的阶段代价和旧计划一样，只是少了第一步（已经付过了）；旧的末端价格 $V_f(x_N)$ 换成了多走一步的阶段代价，加上新的末端价格。') },
        { tex: 'V_f(x_{N+1}) - V_f(x_N) \\le -\\ell(x_N, \\kappa_f(x_N)) \\quad \\text{on } \\mathcal X_f', why: t('The **decrease condition** on the terminal pair (RMD Assumption 2.14): one step of $\\kappa_f$ lowers the end price by at least the stage it costs. For $V_f = x^\\top P_\\infty x$ and $\\kappa_f = -Kx$ this holds with equality: it is the Riccati equation.', '终端这一对的**下降条件**（RMD 假设 2.14）：走一步 $\\kappa_f$，末端价格至少降低这一步的阶段代价。对 $V_f = x^\\top P_\\infty x$、$\\kappa_f = -Kx$，它以等号成立：这正是 Riccati 方程。') },
        { tex: 'J^*(x_1) \\le J(x_1, \\tilde u) \\le J^*(x) - \\ell(x, u_0)', why: t('The optimum is no worse than the candidate. So the optimal cost falls by at least the stage cost at every sample.', '最优解不会比候选更差。所以每个采样时刻，最优代价至少下降一个阶段代价。') },
        { tex: '\\Rightarrow\\ \\ell(x_k, u_k) \\to 0, \\quad x_k \\to x_{\\mathrm{ref}}', why: t('$J^*$ is a *Lyapunov function*: like energy in a system with friction, it can only go down. A non-negative quantity that keeps falling by $\\ell$ can only do so finitely often; with $Q \\succ 0$ (or detectable), the state must converge. This is the classic stability proof of MPC (RMD (2.17)–(2.18)).', '$J^*$ 是一个*李雅普诺夫函数*：就像有摩擦的系统里的能量，它只降不升。一个非负的量，每次至少降一个 $\\ell$，这样的下降不可能无穷无尽；在 $Q \\succ 0$（或可检测）时，状态必然收敛。这就是 MPC 稳定性的经典证明（RMD (2.17)–(2.18)）。') },
      ],
      blank: { line: 2, answer: 'J - l', variables: ['J', 'l'], prompt: t('Upper bound on $J^*(x_1)$, writing $J$ for $J^*(x)$ and $l$ for $\\ell(x, u_0)$.', '写出 $J^*(x_1)$ 的上界，用 $J$ 表示 $J^*(x)$，$l$ 表示 $\\ell(x, u_0)$。') },
      outro: t('Honesty about the world: our terminal set uses braking as $\\kappa_f$, and with the cost $P = Q$ the decrease condition is not proven. The world shows it docking, but what is guaranteed there is feasibility and safety, not convergence.', '对交互要说清楚：我们的终端集用刹车作为 $\\kappa_f$，代价用的是 $P = Q$，下降条件并没有被证明。交互里它确实停稳了，但在那里有保证的是可行与安全，而不是收敛。'),
    },
    {
      id: 'price', kind: 'read', title: t('The price: fewer states where it works', '代价：能工作的状态变少了'),
      blocks: [
        { type: 'p', text: t(
          'Every terminal condition shrinks the set of states from which the QP has a solution at all, the **region of attraction** $\\mathcal X_N$. That is the price of the guarantees. The stricter the end condition and the shorter the window, the smaller $\\mathcal X_N$. The extreme is the classic terminal equality $x_N = $ target (Keerthi and Gilbert, 1988)[^kg]: for the cart at rest at 0 m, reaching the wall and stopping takes at least 7 s (2 s speeding up, 3 s at 2 m/s, 2 s braking), so with any $N < 70$ the QP has no solution at the start, and the cart never moves.',
          '每一个终端条件，都会让"QP 有解"的状态集合变小，这个集合叫**吸引域** $\\mathcal X_N$。这就是那些保证的代价。末端条件越严、窗口越短，$\\mathcal X_N$ 就越小。最极端的是经典的终端等式约束 $x_N = $ 目标（Keerthi 和 Gilbert，1988）[^kg]：小车在 0 米处静止，要开到墙边并停住，至少需要 7 秒（加速 2 秒、以 2 m/s 匀速 3 秒、刹车 2 秒），所以只要 $N < 70$，QP 在起点就无解，小车根本不动。') },
        { type: 'table', head: [t('End of the plan', '计划末端'), t('N = 5', 'N = 5'), t('N = 8', 'N = 8'), t('Shortest N that docks', '能停稳的最短 N')], rows: [
          [t('only the limits', '只有限制'), t('hits at 1.55 m/s', '以 1.55 m/s 撞墙'), t('hits at 1.18 m/s', '以 1.18 m/s 撞墙'), t('19 (7.3 s)', '19（7.3 秒）')],
          [t('+ LQR cost $P$', '+ LQR 代价 $P$'), t('hits at 1.01 m/s', '以 1.01 m/s 撞墙'), t('hits at 0.88 m/s', '以 0.88 m/s 撞墙'), t('20 (7.3 s)', '20（7.3 秒）')],
          [t('terminal set $p_N + 1.95 v_N \\le 10$', '终端集 $p_N + 1.95 v_N \\le 10$'), t('docks at 12.0 s', '12.0 秒停稳'), t('docks at 8.3 s', '8.3 秒停稳'), t('2 (16.7 s)', '2（16.7 秒）')],
          [t('$x_N$ = target', '$x_N$ = 目标'), t('never moves', '一动不动'), t('never moves', '一动不动'), t('70 (7.1 s)', '70（7.1 秒）')],
        ] },
        { type: 'p', text: t(
          'Simulation of the course’s toy cart (Δt = 0.1 s, brakes 1 m/s², top speed 2 m/s). Read it as a trade: the terminal set buys safety at **any** horizon, and pays in speed when the horizon is short, because a 0.5 s plan must stay ready to stop and so brakes early. A good terminal set is as large as possible: it should restrict the plan’s end only where safety really requires it.',
          '以上是课程玩具小车的模拟（Δt = 0.1 秒，刹车 1 m/s²，最高速 2 m/s）。把它读成一笔交易：终端集让**任何**时域都安全，代价是时域短时变慢，因为 0.5 秒的计划必须随时准备刹停，于是刹得早。好的终端集要尽可能大：只在安全确实需要的地方限制计划的末端。') },
        { type: 'cite', key: 'kg', text: t('Keerthi & Gilbert (1988). Optimal infinite-horizon feedback laws for a general class of constrained discrete-time systems. JOTA 57(2), 265–293.', 'Keerthi、Gilbert（1988）。Optimal infinite-horizon feedback laws for a general class of constrained discrete-time systems。JOTA 57(2)，265–293。'), url: 'https://doi.org/10.1007/BF00938540' },
      ],
    },
    // ------------------------------------------------------------------ soft constraints
    {
      id: 'soft', kind: 'read', chapter: t('When a limit cannot be kept', '限制守不住时'), title: t('Soft constraints', '软约束'),
      blocks: [
        { type: 'p', text: t(
          'Recursive feasibility assumed an exact model. A real gust can push the cart to 2.4 m/s, past the speed limit, and then **no** plan can satisfy $v \\le 2$ at the next sample: the QP has no solution through no fault of the design. Real controllers must still output something. The standard answer is to let some constraints be broken, at a price:',
          '递归可行性假设模型准确。可一阵真实的风就能把小车推到 2.4 m/s，超过限速；这时下一个采样时刻**没有**任何计划能满足 $v \\le 2$：QP 无解，而这并不是设计的错。真实的控制器仍然必须给出一个输出。标准做法是：允许某些约束被打破，但要付出代价：') },
        { type: 'math', tex: 'v_k \\le v_{\\max} + s_k,\\quad s_k \\ge 0, \\qquad J + \\sum_k \\big( l_1\\, s_k + l_2\\, s_k^2 \\big)' },
        { type: 'list', items: [
          t('$s_k$, the **slack**: how far the limit is broken at step $k$. A new variable, so the QP always has a solution.', '$s_k$，即**松弛量**：第 $k$ 步打破限制的程度。它是一个新的变量，有了它，QP 永远有解。'),
          t('$l_1 s_k$, the linear price. If $l_1$ is larger than what keeping the limit is worth to the cost (the constraint’s Lagrange multiplier, M4), the soft problem gives **exactly** the hard solution whenever one exists: an *exact penalty*[^km].', '$l_1 s_k$，线性价格。只要 $l_1$ 大于守住这条限制对代价的"价值"（即这条约束的拉格朗日乘子，M4 讲过），只要硬约束问题有解，软约束问题给出的就**恰好**是那个解：这叫*精确罚函数*[^km]。'),
          t('$l_2 s_k^2$, a small quadratic price that keeps the QP strictly convex. A quadratic price alone is never exact: it always trades a little violation for a little cost.', '$l_2 s_k^2$，一个小的二次价格，让 QP 保持严格凸。只用二次价格永远做不到"精确"：它总会用一点点违反去换一点点代价。'),
        ] },
        { type: 'visual', name: 'mpc_soft_limit', params: {}, caption: t('Simulation. $l_1 = 1000$: identical to the hard limit, and a solution at every sample (slacks 0.3, 0.2, 0.1 after the gust). $l_1 = 10$: below the multiplier, so speed is "worth" breaking the limit for; the cart cruises at 2.78 m/s with no gust at all.', '模拟。$l_1 = 1000$：和硬约束完全一样，而且每个时刻都有解（风过后松弛量是 0.3、0.2、0.1）。$l_1 = 10$：低于乘子，于是"为了快"值得打破限制；即使没有风，小车也以 2.78 m/s 行驶。') },
        { type: 'list', items: [
          t('**Soften only what can physically be violated.** A speed limit or a comfort bound can be exceeded for a moment; a wall cannot. Softening the wall does not move the wall, it only stops the plan from knowing where it is. Input limits are physical and stay hard.', '**只软化物理上能被违反的约束。** 限速或舒适性边界可以短暂超过；墙不行。把墙软化并不会让墙挪开，只会让计划不再知道墙在哪。输入限制是物理的，保持为硬约束。'),
          t('**Industry does this routinely.** In Qin and Badgwell’s survey, all products but one enforce output constraints as soft, because hard output constraints cause infeasibility under large disturbances, and they rank constraints by priority[^qin].', '**工业界一直这么做。** Qin 和 Badgwell 的综述里，除了一个产品，其余全都把输出约束做成软约束，因为硬的输出约束在大扰动下会导致无解；它们还会给约束排优先级[^qin]。'),
        ] },
        { type: 'cite', key: 'km', text: t('Kerrigan & Maciejowski (2000). Soft constraints and exact penalty functions in model predictive control. UKACC Control 2000; condition as stated by Wu, Zhou & Braatz (2024), arXiv:2403.18235.', 'Kerrigan、Maciejowski（2000）。Soft constraints and exact penalty functions in model predictive control。UKACC Control 2000；条件的表述引自 Wu、Zhou、Braatz（2024），arXiv:2403.18235。'), url: 'https://spiral.imperial.ac.uk/entities/publication/b1d59b69-3901-41f5-bb9f-f619319fa9dc' },
        QIN,
      ],
    },
    {
      id: 'practice', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('What practitioners actually do', '实际工程里怎么做'),
      blocks: [
        { type: 'p', text: t(
          'Here is a surprise. Qin and Badgwell found that none of the industrial MPC products of their time made full use of terminal sets and costs; the controllers are not nominally stabilizing, are "tested extensively through closed-loop simulation", and practitioners did not see stability as a serious problem[^qin2]. Their horizons are set "long enough to capture the steady-state effects". Theory and practice meet in the middle:',
          '说一个出人意料的事实。Qin 和 Badgwell 发现，当时的工业 MPC 产品没有一个充分用上终端集和终端代价；这些控制器在名义上并不保证稳定，而是"通过大量闭环仿真来测试"，工程师们也不觉得稳定性是个严重问题[^qin2]。它们的时域被设得"足够长，能看到稳态的影响"。理论和实践在中间相遇：') },
        { type: 'list', items: [
          t('**A long horizon is an implicit terminal set.** Make $N\\Delta t$ cover the longest forced manoeuvre (here the stop, $v_{\\max}/a_{\\max}$). It works, but the proof lives only in your simulations, and changes when the limits change (M1: halve the brakes, double $N$).', '**长时域是一个隐含的终端集。** 让 $N\\Delta t$ 盖住最长的被迫动作（这里是刹停，$v_{\\max}/a_{\\max}$）。这样做管用，但证明只存在于你的仿真里，限制一变就得重来（M1：刹车减半，$N$ 加倍）。'),
          t('**A large terminal weight** $\\beta P$ instead of a set: with $\\beta$ large enough, stability holds on a region without imposing $\\mathcal X_f$ (RMD §2.6, Limon et al. 2006)[^rmd4].', '**用大的终端权重** $\\beta P$ 代替终端集：$\\beta$ 足够大时，不加 $\\mathcal X_f$ 也能在某个区域上保证稳定（RMD §2.6，Limon 等 2006）[^rmd4]。'),
          t('**Always a fallback.** Soft output limits so the QP always has a solution, and a safe action (brake, hold, the shifted previous plan) for the rare case it does not.', '**永远准备后备方案。** 输出限制做成软的，让 QP 总有解；再为极少数无解的情况准备一个安全动作（刹车、保持、上一次计划平移后的版本）。'),
        ] },
        { type: 'table', head: [t('Your situation', '你的情况'), t('Do this', '怎么做'), t('Why', '为什么')], rows: [
          [t('Safety-critical, short horizon forced by compute', '安全攸关，算力只允许短时域'), t('Terminal set from a simple safe controller (e.g. "brake"), plus its cost', '用一个简单的安全控制器（比如"刹车"）构造终端集，再配上终端代价'), t('Feasibility and safety are proven for every N; you pay some speed', '对任何 N 都能证明可行与安全；代价是慢一些')],
          [t('Plenty of compute, limits well known', '算力充足，限制清楚'), t('$N\\Delta t$ longer than the longest forced manoeuvre, LQR $P$ as terminal cost, verify by closed-loop simulation', '让 $N\\Delta t$ 长于最长的被迫动作，终端代价用 LQR 的 $P$，用闭环仿真验证'), t('Simple, fast responses; the guarantee is empirical', '简单，响应快；保证来自经验')],
          [t('Disturbances can push you past a limit', '扰动可能把你推过某条限制'), t('Soften that limit with $l_1$ above its multiplier; keep physical limits hard', '把这条限制软化，$l_1$ 取得比它的乘子大；物理限制保持为硬约束'), t('The QP always has an answer, and equals the hard one when that exists', 'QP 永远有答案，且在硬约束有解时与之相同')],
          [t('Tempted to demand $x_N$ = target', '想要求 $x_N$ = 目标'), t('Only with a long horizon', '只在时域很长时这么做'), t('It shrinks the region where the controller works the most', '它让控制器能工作的区域缩得最小')],
        ] },
        { type: 'cite', key: 'qin2', text: t('Qin & Badgwell (2003), §5 and §7; horizon: p. 757.', 'Qin、Badgwell（2003），§5 与 §7；时域：第 757 页。'), url: 'https://doi.org/10.1016/S0967-0661(02)00186-7' },
        { type: 'cite', key: 'rmd4', text: t('Rawlings, Mayne & Diehl (2020), §2.6, pp. 144–146; Limon, Alamo, Salas & Camacho (2006), IEEE TAC 51(5), 832–836.', 'Rawlings、Mayne、Diehl（2020），§2.6，第 144–146 页；Limon、Alamo、Salas、Camacho（2006），IEEE TAC 51(5)，832–836。'), url: 'https://doi.org/10.1109/TAC.2006.875014' },
      ],
    },
    {
      id: 'code', kind: 'code', title: t('A short horizon, made safe', '让短时域也安全'),
      intro: t('The world’s winning setting in cvxpy: $N = 5$, the terminal set, and a soft speed limit, with a gust at 3 s that the hard version could not survive. Run with cvxpy 1.8; the printed output is in the last two lines.', '用 cvxpy 写出交互里的那个解：$N = 5$，终端集，软的限速，并在 3 秒时加一阵风（硬约束版本扛不过去）。用 cvxpy 1.8 运行；打印结果在最后两行。'),
      lang: 'python', code: CODE,
      notes: [
        { lines: [8, 8], text: t('The edge of the terminal set: $v_{\\max}/a_{\\max} - \\Delta t/2$, so that braking never leaves it.', '终端集的边界：$v_{\\max}/a_{\\max} - \\Delta t/2$，保证刹车永远不会离开它。') },
        { lines: [13, 15], text: t('One slack per step on the speed limit, priced $l_1 = 1000$ (above the multiplier) plus a small quadratic term.', '每一步的限速配一个松弛量，价格 $l_1 = 1000$（大于乘子），再加一个小的二次项。') },
        { lines: [19, 22], text: t('Soft speed, hard wall, and the terminal set on $x_N$ only. Delete line 22 and the run stops with “no plan at t = 5.6 s”: the trap, as in the world.', '软的限速、硬的墙，终端集只加在 $x_N$ 上。删掉第 22 行，运行会在“no plan at t = 5.6 s”处停下：正是交互里的陷阱。') },
        { lines: [30, 31], text: t('Should never fire: the terminal set keeps the wall feasible, the slack keeps the speed limit feasible.', '这里不应该被触发：终端集保证墙那条约束永远可行，松弛量保证限速永远可行。') },
        { lines: [35, 36], text: t('The gust: 2.4 m/s, past the limit. A hard speed limit would leave the QP without a solution for 3 samples.', '这阵风：2.4 m/s，超过了限速。若限速是硬的，QP 会连续 3 个时刻无解。') },
        { lines: [42, 43], text: t('Same docking time as the world’s $N = 5$ terminal-set run (12.0 s); the slack is used only right after the gust.', '停稳时间和交互里 $N = 5$、终端集的结果一样（12.0 秒）；松弛量只在风过后用了一下。') },
      ],
    },
    // ------------------------------------------------------------------ checks
    {
      id: 'q-edge', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('A different cart', '换一辆车'), skill: 'terminal-set', purpose: 'check',
      prompt: t('A heavier cart: top speed 3 m/s, brakes 1 m/s², sampled every 0.2 s. Its terminal set is $p_N + c\\,v_N \\le p_{\\max}$. What is $c$, in seconds?', '换一辆更重的车：最高速 3 m/s，刹车 1 m/s²，每 0.2 秒采样一次。它的终端集是 $p_N + c\\,v_N \\le p_{\\max}$。$c$ 是多少秒？'),
      question: { type: 'number', answer: 2.9, tolerance: 0.01, unit: 's', wrong: [
        { answer: 3, feedback: t('That is $v_{\\max}/a_{\\max}$, the continuous-time slope. At top speed one sample of braking would push $p + 3v$ up by $a\\Delta t^2/2$: subtract $\\Delta t/2$.', '这是 $v_{\\max}/a_{\\max}$，连续时间下的斜率。在最高速时，刹车一个采样周期会让 $p + 3v$ 增加 $a\\Delta t^2/2$：要减去 $\\Delta t/2$。') },
        { answer: 1.95, feedback: t('That is the course cart’s value. Recompute with this cart’s top speed and sample time.', '这是课程里那辆车的值。用这辆车的最高速度和采样时间重新算。') },
      ] },
      explain: t('$c = v_{\\max}/a_{\\max} - \\Delta t/2 = 3 - 0.1 = 2.9$ s. One braking sample at 3 m/s changes $p + c\\,v$ by $3(0.2) - 0.02 - 0.2c = 0$.', '$c = v_{\\max}/a_{\\max} - \\Delta t/2 = 3 - 0.1 = 2.9$ 秒。以 3 m/s 刹车一个周期，$p + c\\,v$ 的变化是 $3(0.2) - 0.02 - 0.2c = 0$。'),
    },
    {
      id: 'q-cost', kind: 'checkpoint', title: t('Why the cost alone failed', '为什么只靠代价不行'), skill: 'terminal-cost', purpose: 'check',
      prompt: t('A colleague adds the LQR cost-to-go $P$ as the terminal cost of a 0.5 s docking MPC and is surprised it still crashes. Which explanation is right?', '同事给一个 0.5 秒的停靠 MPC 加上了 LQR 剩余代价 $P$ 作为终端代价，结果还是撞墙，他很意外。哪个解释是对的？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('$P$ prices the end as if braking were unlimited, and a cost cannot remove plans: the plan can still end in the trap', '$P$ 给末端定价时假设刹车不受限，而代价不能删掉任何计划：计划仍可以结束在陷阱里'), correct: true },
        { id: 'b', label: t('$P$ was computed wrongly; the right $P$ would fix it', '$P$ 算错了；算对了就能解决'), misconception: 'terminal-cost-enough' },
        { id: 'c', label: t('The terminal cost needs a much larger weight on velocity', '终端代价里速度的权重要大得多'), misconception: 'terminal-cost-enough' },
        { id: 'd', label: t('Terminal costs only matter for long horizons', '终端代价只对长时域有用') },
      ] },
      explain: t('A cost changes which feasible plan is chosen; only a constraint changes which plans are allowed. Pair $P$ with a terminal set where its price is honest.', '代价改变的是在可行计划中选哪一个；只有约束才能改变哪些计划被允许。给 $P$ 配一个让它的价格"说实话"的终端集。'),
    },
    {
      id: 'q-soft', kind: 'checkpoint', title: t('A soft limit that leaks', '漏了的软约束'), skill: 'soft-constraints', purpose: 'check',
      prompt: t('After softening the speed limit with $l_1 = 10$, the cart cruises at 2.78 m/s although there is no gust at all. What do you change?', '把限速软化、取 $l_1 = 10$ 之后，即使完全没有风，小车也以 2.78 m/s 行驶。你要改什么？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('Raise $l_1$ above the speed constraint’s multiplier (e.g. 1000), keep the wall hard', '把 $l_1$ 提高到大于限速约束的乘子（比如 1000），墙保持为硬约束'), correct: true },
        { id: 'b', label: t('Raise only $l_2$, the quadratic price', '只调高二次价格 $l_2$'), misconception: 'slack-any-price' },
        { id: 'c', label: t('Soften the wall too, so everything is consistent', '把墙也软化，这样就一致了'), misconception: 'soften-everything' },
        { id: 'd', label: t('Make the speed limit hard again', '把限速改回硬约束') },
      ] },
      explain: t('Below the multiplier, breaking the limit is "worth it" to the cost. Above it the soft problem returns the hard solution whenever that exists, and still has an answer after a gust. A quadratic price alone is never exact; making the limit hard again brings back infeasibility after gusts.', '价格低于乘子时，打破限制对代价来说"划算"。高于乘子时，只要硬约束有解，软约束问题就返回同一个解，而且风过后仍然有解。只用二次价格永远做不到精确；改回硬约束，风一来又会无解。'),
    },
    {
      id: 'q-explain', kind: 'checkpoint', title: t('Explain the log', '解释这份记录'), skill: 'recursive-feasibility', purpose: 'check',
      prompt: t('An engineer reads a crash log: "every QP was feasible until 0.5 s before the crash; then the solver failed, so the solver caused the crash." Correct them in two or three sentences.', '一位工程师看着撞车记录说："直到撞车前 0.5 秒，每个 QP 都有解；然后求解器失败了，所以是求解器导致了撞车。"用两三句话纠正他。'),
      question: { type: 'text', placeholder: t('The crash was already certain when…', '在……的时候，撞墙已经注定……'), rubric: {
        key_points: [
          t('The crash was already certain before the QP became infeasible: the state was in the trap (feasible QP, unavoidable crash) because the window was shorter than the stop.', '在 QP 无解之前，撞墙就已经注定：状态处在陷阱里（QP 有解，撞墙不可避免），因为窗口比刹停所需的时间短。'),
          t('The solver did its job; the formulation lacked recursive feasibility. Feasible now does not imply feasible later.', '求解器尽了职责；问题的表述缺少递归可行性。现在有解，不代表以后有解。'),
          t('Fix: a terminal set (end where a stop is possible) or a horizon covering the stop, plus a fallback.', '补救：加终端集（结束在还能刹停的地方），或让时域盖住刹停，再加一个后备方案。'),
        ],
        model_answer: t('The solver was not the cause: the cart entered the trap about half a second before the QP failed, a state from which every plan inside the short window still stayed off the wall but no real stop was possible. The formulation had no recursive feasibility, because nothing required the plan to end in a state from which it could still stop. A terminal set such as p + 1.95 v ≤ 10, or a look-ahead longer than the stop, prevents it.', '不是求解器的错：在 QP 失败之前大约半秒，小车就进了陷阱，在那个状态下，短窗口里的每份计划都还碰不到墙，可真实世界里已经停不下来了。问题的表述没有递归可行性，因为没有任何条件要求计划结束在还能刹停的状态。加一个终端集（比如 p + 1.95 v ≤ 10），或者让预测时域长于刹停时间，就能避免。'),
        min_points: 2,
      } },
    },
  ],
};
