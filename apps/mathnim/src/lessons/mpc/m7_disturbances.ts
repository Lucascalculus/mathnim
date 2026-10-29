// M7 模型不准时 / When the model is wrong. The same cart, now with a steady
// headwind its model is not told about, a noisy position sensor, and pushes it
// cannot predict. Three fixes, in order of how often you need them:
// offset-free MPC (estimate the push, shift the target: integral action), a
// state estimator (Kalman filter, brief) and robust tube MPC (brief).
// Plan and numbers: docs/lessons/mpc/checkpoints/m7.md; sources:
// docs/lessons/mpc/research-m7.md. Visuals: mpc_offset (scene + world),
// mpc_kalman, mpc_tube (scenes); math in packages/visuals/src/mpc/disturbance.ts.
import type { Lesson } from '@mathnim/core';
import { OFFSET_LABELS } from '@mathnim/visuals/mpc';
import { attach, t, vis } from './common';

/** The last setting the world reported (the visual emits 'run' on every release and on a new wind). */
interface Run {
  q: number;
  estimate: boolean;
  dhat: number;
  wind_changes: number;
  d: number;
  offset: number;
  Kp: number;
  at_flag: boolean;
  which: string;
}
const L10 = (l: { en: string; zh: string }) => t(l.en, l.zh);

const OFFSET_FREE_CODE = `import numpy as np
import cvxpy as cp
from scipy.linalg import solve_discrete_are

dt = 0.1
A = np.array([[1, dt], [0, 1]])
B = np.array([[dt**2 / 2], [dt]])
C = np.array([[1, 0]])
Q, R, N = np.diag([1.0, 0.0]), np.array([[0.1]]), 20
P = solve_discrete_are(A, B, Q, R)              # terminal cost: the LQR cost-to-go
p_ref, a_max = 6.0, 1.0

def target(d_hat):
    """Steady target: [[I-A, -B], [C, 0]] [x_s; u_s] = [B d_hat; r]."""
    M = np.block([[np.eye(2) - A, -B], [C, np.zeros((1, 1))]])
    z = np.linalg.solve(M, np.concatenate([B[:, 0] * d_hat, [p_ref]]))
    return z[:2], z[2]

def mpc(x0, d_hat):
    x_s, u_s = target(d_hat)
    x = cp.Variable((2, N + 1)); u = cp.Variable((1, N))
    cost, cons = 0, [x[:, 0] == x0]
    for k in range(N):
        cost += cp.quad_form(x[:, k] - x_s, Q) + cp.quad_form(u[:, k] - u_s, R)
        cons += [x[:, k + 1] == A @ x[:, k] + B[:, 0] * (u[0, k] + d_hat),   # the model knows d_hat
                 cp.abs(u[0, k]) <= a_max]
    cost += cp.quad_form(x[:, N] - x_s, P)
    cp.Problem(cp.Minimize(cost), cons).solve()
    return u.value[0, 0]

def run(estimate, d=-0.3, lam=0.2, steps=120):
    x, d_hat = np.array([p_ref, 0.0]), 0.0
    for k in range(steps):
        u = mpc(x, d_hat)
        x_pred = A @ x + B[:, 0] * (u + d_hat)      # what the model expects
        x = A @ x + B[:, 0] * (u + d)               # what the real cart does
        if estimate:
            d_hat += lam * (x[1] - x_pred[1]) / dt  # take in 20% of the surprise
    return x[0] - p_ref, d_hat

print("nominal:     offset %.1f cm" % (100 * run(False)[0]))
off, dh = run(True)
print("offset-free: offset %.1f cm, d_hat = %.3f" % (abs(100 * off), dh))
`;

const last = (w: { state: Record<string, unknown> }): Run | undefined => w.state.last as Run | undefined;

export const lesson: Lesson = {
  id: 'mpc-m7-disturbances',
  title: t('When the model is wrong', '模型不准时'),
  description: t(
    'A steady push the model does not know leaves the cart short of its target, however you tune it. Estimating the push removes the offset (integral action, the MPC way); a Kalman filter supplies the states you cannot measure; tube MPC keeps hard limits under pushes that keep changing.',
    '模型不知道的一股恒定推力，会让小车停在目标前面，怎么调参都消不掉。把这股推力估计出来，偏差就没了（MPC 版的积分作用）；卡尔曼滤波补上测不到的状态；管道 MPC 在不停变化的推力下守住硬约束。'),
  mode: 'essay',
  skills: [
    { id: 'offset-cause', name: t('Why a model error leaves a steady offset', '模型误差为什么留下稳态偏差') },
    { id: 'offset-free', name: t('Offset-free MPC: estimate the disturbance, shift the target', '无偏差 MPC：估计扰动，移动目标'), prerequisites: ['offset-cause'] },
    { id: 'disturbance-placement', name: t('Where the disturbance model must enter', '扰动模型该加在哪里'), prerequisites: ['offset-free'] },
    { id: 'kalman', name: t('What a Kalman filter does', '卡尔曼滤波在做什么') },
    { id: 'tube', name: t('The tube idea of robust MPC', '鲁棒 MPC 的管道思想') },
  ],
  misconceptions: [
    { id: 'q-removes-offset', description: t('A larger weight on the error removes the offset.', '把误差的权重调大，偏差就没了。') },
    { id: 'replan-removes-offset', description: t('Re-planning from the measured state removes any model error.', '从测量状态重新规划，任何模型误差都会被消掉。') },
    { id: 'push-is-disturbance', description: t('The push the controller holds is the disturbance (wrong sign).', '控制器保持的推力就是扰动本身（符号弄反）。') },
    { id: 'bias-always-works', description: t('Adding an output bias to the model always removes the offset.', '给模型加一个输出偏置，总能消掉偏差。') },
    { id: 'noise-raises-gain', description: t('A noisier sensor makes the Kalman filter follow the measurements more.', '传感器噪声越大，卡尔曼滤波越跟着测量走。') },
    { id: 'feedback-is-enough', description: t('Feedback that keeps the cart near the plan is enough to keep it off a limit the plan touches.', '只要反馈把小车拉在计划附近，就不会越过计划贴着的那条限制。') },
  ],
  steps: [
    // ------------------------------------------------------------------ the problem
    {
      id: 'why', kind: 'read', chapter: t('The problem', '问题'), title: t('Every model is wrong', '模型总是不准的'),
      blocks: [
        { type: 'p', text: t(
          'Everything so far trusted the model $x_{k+1} = A x_k + B u_k$. M1 showed that re-planning from the measured state absorbs a one-off push: the next plan simply starts from where the cart really is. A real cart meets worse: a slope or a headwind that never lets go, a sensor that only reads position and adds noise, gusts that come and go. Three different things go wrong, and each has its own fix:',
          '到目前为止，我们一直相信模型 $x_{k+1} = A x_k + B u_k$。M1 讲过，从测量到的状态重新规划，能化解偶然被推一下：下一次规划直接从小车真实所在的位置出发。可真实的小车碰到的更麻烦：一段坡、一阵逆风，一直不松手；传感器只读位置，还带噪声；阵风时有时无。这是三种不同的问题，各有各的办法：') },
        { type: 'table', head: [t('What goes wrong', '哪里不对'), t('What you see', '会看到什么'), t('The fix', '办法')], rows: [
          [t('a steady push the model does not know', '模型不知道的恒定推力'), t('it rests short of the target, forever', '永远停在目标前面'), t('**offset-free MPC**: estimate the push', '**无偏差 MPC**：把推力估计出来')],
          [t('noisy or missing measurements', '测量有噪声，或者根本测不到'), t('jittery inputs, or no speed to plan from', '输入抖个不停，或者没有速度可用来规划'), t('a **state estimator** (Kalman filter)', '**状态估计器**（卡尔曼滤波）')],
          [t('bounded pushes that keep changing, near a hard limit', '大小有界、不停变化的推力，旁边还有硬约束'), t('it crosses the limit the plan just touches', '越过计划刚好贴着的那条限制'), t('**robust (tube) MPC**: leave a margin', '**鲁棒（管道）MPC**：留出余量')],
        ] },
        { type: 'p', text: t('Start with the first, because it surprises people: re-planning does **not** fix it. Watch.', '先说第一种，因为它最出乎意料：重新规划**治不了**它。先看一段。') },
      ],
    },
    {
      id: 'offset-scene', kind: 'scene', title: t('A wind the model does not know', '模型不知道的风'),
      scene: vis('mpc_offset', { story: 'offset' }),
      narration: t(
        'The cart is parked at the flag, six metres along the track. A steady headwind blows, and the model knows nothing about it. § The controller is the MPC from M3. § The wind pushes the cart back, and it comes to rest about eleven centimetres short, holding a push of plus zero point three. § Now look at the dashed curve: the plan made at ten seconds. It still expects to get back to the flag. Every tenth of a second the plan says "I will reach the flag", and every tenth of a second a wind it does not know about holds the cart where it is.',
        '小车停在旗子处，轨道上六米的位置。一阵恒定的逆风吹来，模型对它一无所知。§控制器就是 M3 里的那个 MPC。§风把小车往回推，它最后停在离旗子大约十一厘米的地方，一直保持着正零点三的推力。§再看那条虚线：这是第十秒时做的计划。它仍然以为自己能回到旗子。每过零点一秒，计划都说"我会到旗子那儿"；每过零点一秒，它不知道的那阵风又把小车按在原地。'),
    },
    {
      id: 'offset', kind: 'derive', chapter: t('Why it rests short', '为什么停不到位'), title: t('Where the cart can rest', '小车能停在哪里'), skill: 'offset-cause',
      intro: t(
        'Near rest no limit is active, so this MPC acts as a fixed feedback law (M3): $u = -K\\,(x - x_{\\text{ref}})$ with $K = [K_p,\\ K_v]$. Find where the real cart can come to rest.',
        '停下来的附近没有约束起作用，所以这个 MPC 就是一个固定的反馈律（M3）：$u = -K\\,(x - x_{\\text{ref}})$，其中 $K = [K_p,\\ K_v]$。来找找真实的小车能停在哪里。'),
      lines: [
        { tex: 'x_{k+1} = A x_k + B\\,(u_k + d)', why: t('The real cart: the wind adds an acceleration $d$ that the model does not have. Here $d = -0.3$ m/s² (a headwind; a slope of 1.75° pulls as hard).', '真实的小车：风额外加了一个加速度 $d$，模型里没有它。这里 $d = -0.3$ m/s²（逆风；1.75° 的坡拉得一样狠）。') },
        { tex: 'v = 0,\\quad u + d = 0 \\;\\Rightarrow\\; u = -d', why: t('At rest the speed is zero and the net acceleration is zero, so the controller must hold a push that cancels the wind exactly: $+0.3$.', '停住时速度为零，合加速度也为零，所以控制器必须保持一股正好抵消风的推力：$+0.3$。') },
        { tex: 'u = -K_p\\,e \\;\\Rightarrow\\; e = \\frac{d}{K_p}', why: t('With $v = 0$ the law can only produce that push from a position error $e = p - p_{\\text{ref}}$. No error, no push: so the cart must rest away from the flag.', '$v = 0$ 时，这个反馈律只能靠位置误差 $e = p - p_{\\text{ref}}$ 产生那股推力。没有误差就没有推力，所以小车只能停在离旗子有一段距离的地方。') },
        { tex: 'q = 1:\\quad K_p = 2.79,\\qquad e = \\frac{-0.3}{2.79} = -10.8\\ \\text{cm}', why: t('Exactly what the scene showed. The MPC solved its problem perfectly; the problem it was given is wrong.', '和刚才看到的完全一样。MPC 把它的问题解得一点不差；错的是交给它的那个问题。') },
      ],
      blank: { line: 2, answer: 'd/k', variables: ['d', 'k'], prompt: t('The resting error $e$, in $d$ and $K_p$ (write k for $K_p$).', '用 $d$ 和 $K_p$ 写出停住时的误差 $e$（用 k 表示 $K_p$）。') },
      outro: t(
        'This is not about MPC: any controller that pushes only in proportion to the error has it (a P controller does too). Re-planning does not help, because every new plan uses the same wrong model.',
        '这和 MPC 本身无关：任何只按误差成比例出力的控制器都有这个问题（P 控制器也一样）。重新规划也没用，因为每一次新计划用的都是同一个错的模型。'),
    },
    {
      id: 'q-predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'offset-cause', purpose: 'predict',
      prompt: t('Raise the position weight $q$ in $Q = \\text{diag}(q, 0)$ from 1 to 10. The gain becomes $K_p = 8.0$. Where does the cart rest now?', '把 $Q = \\text{diag}(q, 0)$ 里的位置权重 $q$ 从 1 调到 10，增益变成 $K_p = 8.0$。现在小车停在哪里？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('On the flag: a big enough weight on the distance removes the offset', '就在旗子上：距离的权重够大，偏差就没了'), misconception: 'q-removes-offset' },
        { id: 'b', label: t('About 3.8 cm short: smaller, but still there', '离旗子约 3.8 cm：变小了，但还在'), correct: true },
        { id: 'c', label: t('Still 10.8 cm short: the weight changes how fast, not where', '还是 10.8 cm：权重只改快慢，不改停在哪') },
        { id: 'd', label: t('Past the flag', '冲过旗子') },
      ] },
      explain: t('$e = -0.3 / 8.0 = -3.75$ cm. A larger $q$ only buys a larger $K_p$, and $d / K_p$ is zero only for an infinite gain. You will see it in the world next.', '$e = -0.3 / 8.0 = -3.75$ cm。$q$ 调大只是换来更大的 $K_p$，而 $d / K_p$ 只有在增益无穷大时才是零。下面在交互里亲眼看看。'),
    },
    {
      id: 'fix-idea', kind: 'read', chapter: t('Offset-free MPC', '无偏差 MPC'), title: t('Tell the model about the wind', '把风告诉模型'),
      blocks: [
        { type: 'p', text: t(
          'The offset comes from the model, not the optimiser, so fix the model. Give it a disturbance $\\hat d$, an extra constant acceleration. Then the planner knows that staying at the flag takes a steady push $u_s = -\\hat d$, plans for it, and the resting error becomes',
          '偏差出在模型上，不在优化器上，那就修模型。给模型加一个扰动 $\\hat d$，也就是一个额外的恒定加速度。这样规划器就知道：要停在旗子上，得一直保持推力 $u_s = -\\hat d$；它会把这股推力算进计划，停住时的误差变成') },
        { type: 'math', tex: 'e = \\frac{d - \\hat d}{K_p}' },
        { type: 'p', text: t(
          'Zero when $\\hat d = d$, for any $K_p$. But nobody tells you $d$. Try to find it by hand first: everything you need is on the screen.',
          '只要 $\\hat d = d$，不管 $K_p$ 是多少，误差都是零。可没有人会告诉你 $d$ 是多少。先试着手动把它找出来：需要的信息都在屏幕上。') },
      ],
    },
    {
      id: 'offset-world', kind: 'explore', title: t('Put the cart on the flag', '让小车停到旗子上'), skill: 'offset-free',
      scene: vis('mpc_offset'),
      prompt: t(
        'The same headwind blows; its strength is not shown. (1) With $\\hat d$ set **by hand**, put the cart on the flag (within 5 mm). (2) Then press **New wind** and keep the cart on the flag without guessing the new wind yourself.',
        '还是那阵逆风，只是不告诉你它多大。（1）**手动设定** $\\hat d$，让小车停到旗子上（误差 5 mm 以内）。（2）然后按 **换一阵风**，在不自己猜新风力的前提下，让小车依然停在旗子上。'),
      cue: [L10(OFFSET_LABELS.q), L10(OFFSET_LABELS.dhat), L10(OFFSET_LABELS.source)],
      setup: attach('mpc_offset'),
      actions: [{ id: 'wind', label: t('New wind', '换一阵风'), run: (scene: any) => scene.new_wind() }],
      goals: [
        { id: 'by-hand', check: (s: any) => !s.estimating() && s.at_flag(), message: t(
          '$\\hat d = -0.30$. The model now knows the wind: the push it plans to hold, $u_s = -\\hat d = +0.30$, is exactly what the cart needs, and $(d - \\hat d)/K_p = 0$. You could read $d$ off the cart itself: at rest it held $+0.30$, so the wind is $-0.30$.',
          '$\\hat d = -0.30$。模型现在知道这阵风了：它打算保持的推力 $u_s = -\\hat d = +0.30$ 正是小车需要的，$(d - \\hat d)/K_p = 0$。$d$ 其实可以从小车身上读出来：停住时它保持着 $+0.30$ 的推力，所以风就是 $-0.30$。') },
        { id: 'estimated', check: (s: any) => s.estimating() && s.at_flag() && Math.round(s.wind_n.get_value()) >= 1, message: t(
          'Estimated online, $\\hat d$ found the new wind by itself (see the readout) and the cart rests on the flag, for any wind and any $q$. That is offset-free MPC.',
          '在线估计时，$\\hat d$ 自己找到了新的风力（看右边的读数），小车停在旗子上；换什么风、取什么 $q$ 都一样。这就是无偏差 MPC。') },
      ],
      detectors: [
        { id: 'record', on: (e, w) => { if (e.type === 'run') w.state.last = e.data; return null; } },
        { id: 'just-raise-q', on: (e) => {
          const r = e.data as Run | undefined;
          return e.type === 'run' && r && !r.estimate && Math.abs(r.dhat) < 0.005 && r.q >= 5 ? { kind: 'misconception', id: 'q-removes-offset', message: t(
            `q = ${r.q}: K_p = ${r.Kp.toFixed(1)} and the cart still rests ${Math.abs(r.offset * 100).toFixed(1)} cm short. The weight only raises the gain; d / K_p never reaches zero.`,
            `q = ${r.q}：K_p = ${r.Kp.toFixed(1)}，小车还是停在离旗子 ${Math.abs(r.offset * 100).toFixed(1)} cm 的地方。权重只是把增益调大；d / K_p 永远到不了零。`) } : null;
        } },
        { id: 'wrong-sign', on: (e) => {
          const r = e.data as Run | undefined;
          return e.type === 'run' && r && !r.estimate && r.dhat * r.d < 0 && Math.abs(r.dhat) >= 0.1 ? { kind: 'misconception', id: 'push-is-disturbance', message: t(
            'The offset grew: this d̂ has the wrong sign. The push the cart holds cancels the wind, so the wind is that push with the opposite sign.',
            '偏差反而变大了：这个 d̂ 符号反了。小车保持的推力是用来抵消风的，所以风是这股推力取相反的符号。') } : null;
        } },
        { id: 'retune', on: (e) => {
          const r = e.data as Run | undefined;
          return e.type === 'run' && r && r.which === 'dhat' && !r.estimate && r.wind_changes >= 1 ? { kind: 'progress', id: 'retune', message: t(
            'A new wind, a new guess by hand. Something has to do this every time the wind changes.',
            '换了风，就得再手动猜一次。每次风一变，总得有人做这件事。') } : null;
        } },
      ],
      lines: [
        { text: t('The bold line on the right says where the cart rests, and the line below it the push it holds. Both are clues to the wind.', '右边加粗的那行写着小车停在哪里，下面一行是它保持的推力。这两行都是关于风的线索。'), when: 'enter' },
        { text: t('At rest, the push the cart holds exactly cancels the wind. What does that tell you about d?', '停住时，小车保持的推力正好抵消风。这能告诉你 d 是多少吗？'), when: 'idle' },
        { text: t('A much bigger q, and the cart is still short. The weight only raises the gain, and the offset is d over the gain.', 'q 调大了很多，小车还是停不到位。权重只会抬高增益，而偏差是 d 除以增益。'), when: { finding: 'q-removes-offset' } },
        { text: t('Further away than before: the sign is flipped. The cart pushes forward against the wind, so the wind itself points backward.', '比刚才离得更远了：符号反了。小车向前顶着风，所以风本身是朝后的。'), when: { finding: 'push-is-disturbance' } },
        { text: t('Guessing again after every new wind is a job for the controller. Let d-hat come from an online estimate.', '每换一阵风就重新猜一次，这活儿应该交给控制器。让 d̂ 改为在线估计。'), when: { finding: 'retune' } },
        { text: t('The estimate learned the wind from its own prediction errors. Next: why that always works.', '估计值从自己的预测误差里学到了风力。下一页讲为什么它总是管用。'), when: 'goal' },
      ],
      hints: [
        t('At rest the push it holds cancels the wind exactly.', '停住时，它保持的推力正好抵消风。'),
        t('It holds +0.30 m/s², so d = −0.30. Set d̂ to −0.30, then for part 2 switch d̂ to “estimated online”.', '它保持 +0.30 m/s²，所以 d = −0.30。把 d̂ 设为 −0.30；第 2 问把 d̂ 的来源换成"在线估计"。'),
      ],
      solve: (s: any, _c, w) => {
        s.dh.set_value(-0.3);
        w.emit('run', { ...s.report(), which: 'dhat' });
        s.new_wind();
        s.est.set_value(1);
        w.emit('run', { ...s.report(), which: 'source' });
      },
    },
    {
      id: 'offset-free', kind: 'derive', title: t('What the estimator does', '估计器做了什么'), skill: 'offset-free',
      intro: t(
        'Give the model one more state, the disturbance, and assume it is constant:',
        '给模型多加一个状态，也就是扰动，并假设它是常数：'),
      lines: [
        { tex: '\\begin{aligned} x_{k+1} &= A x_k + B\\,(u_k + d_k) \\\\ d_{k+1} &= d_k \\end{aligned}', why: t('The augmented model. $d$ enters exactly where the wind does: added to the acceleration ($B_d = B$). "Constant" is what the model assumes; a slowly changing push is simply followed.', '增广模型。$d$ 加在风真正作用的地方：叠加到加速度上（$B_d = B$）。"常数"只是模型的假设；推力慢慢变，估计值就跟着变。') },
        { tex: '\\hat d_{k+1} = \\hat d_k + \\lambda\\,\\frac{v_{k+1} - \\hat v_{k+1}}{\\Delta t}', why: t('$\\hat v_{k+1}$ is the speed the model predicted with $\\hat d_k$. The surprise divided by $\\Delta t$ is the acceleration the model missed; take in a share $\\lambda = 0.2$ of it each step.', '$\\hat v_{k+1}$ 是模型用 $\\hat d_k$ 预测的速度。这个"意外"除以 $\\Delta t$，就是模型漏算的加速度；每一步吸收其中 $\\lambda = 0.2$ 的一份。') },
        { tex: '\\hat d_{k+1} - d = (1 - \\lambda)\\,(\\hat d_k - d)', why: t('With a constant $d$ the surprise is exactly $(d - \\hat d_k)\\,\\Delta t$, so the error shrinks by a factor 0.8 every step: after 2 s, $0.8^{20} \\approx 1\\%$ is left.', '$d$ 不变时，"意外"恰好是 $(d - \\hat d_k)\\,\\Delta t$，所以误差每一步缩小到 0.8 倍：2 秒后只剩 $0.8^{20} \\approx 1\\%$。') },
        { tex: '\\hat d_k = \\hat d_0 + \\lambda \\sum_{j < k} \\frac{v_{j+1} - \\hat v_{j+1}}{\\Delta t}', why: t('Unrolled: $\\hat d$ is a running sum of prediction errors. That is integral action, the I of PID, built into the model. It stops changing only when the prediction error is zero.', '展开来看：$\\hat d$ 是预测误差的累加和。这就是积分作用，PID 里的那个 I，只不过放进了模型里。只有预测误差为零时，它才不再变化。') },
        { tex: '\\begin{bmatrix} I - A & -B \\\\ C & 0 \\end{bmatrix} \\begin{bmatrix} x_s \\\\ u_s \\end{bmatrix} = \\begin{bmatrix} B\\hat d \\\\ r \\end{bmatrix} \\;\\Rightarrow\\; x_s = \\begin{bmatrix} 6 \\\\ 0 \\end{bmatrix},\\; u_s = -\\hat d', why: t('Each step, recompute where the model can rest at the reference: $x_s$ is a fixed point of the model with $\\hat d$, and its output $C x_s$ is the reference $r$. The MPC then penalises $x - x_s$ and $u - u_s$ instead of $x - x_{\\text{ref}}$ and $u$.', '每一步都重新算一次：模型在参考点上停得住的状态和输入。$x_s$ 是带 $\\hat d$ 的模型的不动点，它的输出 $C x_s$ 等于参考 $r$。然后 MPC 惩罚的是 $x - x_s$ 和 $u - u_s$，而不是 $x - x_{\\text{ref}}$ 和 $u$。') },
      ],
      blank: { line: 2, answer: '(1-l)*e', variables: ['l', 'e'], prompt: t('The next error $\\hat d_{k+1} - d$, if the current one is $e$ (write l for $\\lambda$).', '如果当前误差是 $e$，下一步的误差 $\\hat d_{k+1} - d$ 是多少？（用 l 表示 $\\lambda$）') },
      outro: t(
        'Why the offset must vanish: if the loop settles, $\\hat d$ stops changing, so the prediction error is zero. At that rest point the model with $\\hat d$ predicts the cart exactly, and the target was built so that this model rests on the reference. The argument never uses what really causes the push: a slope, a heavier cart, friction, a wrong $B$.',
        '偏差为什么一定会消失：如果闭环稳定下来，$\\hat d$ 就不再变化，说明预测误差为零。在这个静止点上，带 $\\hat d$ 的模型对小车的预测分毫不差；而目标正是按"这个模型停在参考点上"算出来的。整个论证从来没用到推力的真正来源：坡、更重的车、摩擦，还是 $B$ 本身不准，都一样。'),
    },
    {
      id: 'where-enters', kind: 'read', title: t('Where the disturbance enters matters', '扰动加在哪里很要紧'),
      blocks: [
        { type: 'p', text: t(
          'The textbook formulation lets the disturbance enter the states ($B_d$) or the measurement ($C_d$): $x^+ = Ax + Bu + B_d d$, $y = Cx + C_d d$. The one requirement is that the estimator can tell $d$ apart from the state: the augmented system must be *detectable*, which for a constant $d$ is the rank test[^rmd]',
          '教科书的写法允许扰动作用在状态上（$B_d$），也可以作用在测量上（$C_d$）：$x^+ = Ax + Bu + B_d d$，$y = Cx + C_d d$。唯一的要求是估计器能把 $d$ 和状态区分开：增广系统必须是*可检测的*。对于常数 $d$，就是下面这个秩判据[^rmd]') },
        { type: 'math', tex: '\\operatorname{rank} \\begin{bmatrix} I - A & -B_d \\\\ C & C_d \\end{bmatrix} = n + n_d' },
        { type: 'p', text: t('Our cart measures position only ($n = 2$, one disturbance, so the matrix is 3 × 3):', '我们的小车只测位置（$n = 2$，一个扰动，所以这是个 3 × 3 矩阵）：') },
        { type: 'list', items: [
          t('**A push on the acceleration**, $B_d = B$, $C_d = 0$: the determinant is $\\Delta t^2 \\neq 0$, rank 3. It works.', '**加在加速度上的推力**，$B_d = B$，$C_d = 0$：行列式是 $\\Delta t^2 \\neq 0$，秩为 3。可行。'),
          t('**An output bias**, $B_d = 0$, $C_d = 1$ ("the sensor is off by $d$"): the middle row is all zeros, rank 2. Not detectable.', '**输出偏置**，$B_d = 0$，$C_d = 1$（"传感器读数差了 $d$"）：中间一行全是零，秩为 2。不可检测。'),
        ] },
        { type: 'p', text: t(
          'Why the bias fails here: a cart can rest anywhere. "The sensor reads 10.8 cm too little" and "the cart really rests 10.8 cm short" produce exactly the same measurements, so no estimator can tell them apart. Industry’s classic bias update (a constant output disturbance) gives integral action for stable plants, but fails for integrating ones like this cart[^qb]. The rule: put the disturbance where the real one enters, and use as many disturbances as measured outputs ($n_d = p$)[^pr][^mb].',
          '偏置为什么在这里失效：小车停在哪里都行。"传感器少读了 10.8 cm"和"小车真的停在差 10.8 cm 的地方"产生的测量一模一样，任何估计器都分不出来。工业上经典的偏置更新（恒定输出扰动）对稳定的对象能提供积分作用，但对小车这种积分型对象就不行[^qb]。规则是：扰动加在真实扰动作用的地方，扰动个数取成测量输出的个数（$n_d = p$）[^pr][^mb]。') },
        { type: 'callout', kind: 'note', title: t('One more condition', '还有一个条件'), body: t('Zero offset also needs the limits to be inactive at rest. If holding the flag took more than $a_{\\max}$, no controller could do it; the book states the same either-or for PID’s integral action.', '零偏差还要求停住时约束不起作用。如果停在旗子上需要的推力超过 $a_{\\max}$，哪个控制器都做不到；书里对 PID 的积分作用也给出了同样的"二选一"。') },
        { type: 'cite', key: 'rmd', text: t('Rawlings, Mayne & Diehl (2017/2026). Model Predictive Control: Theory, Computation, and Design, 2nd ed., §1.5.2 (Lemma 1.8, 1.10).', 'Rawlings、Mayne、Diehl（2017/2026）。Model Predictive Control: Theory, Computation, and Design，第 2 版，§1.5.2（引理 1.8、1.10）。'), url: 'https://sites.engineering.ucsb.edu/~jbraw/mpc/MPC-book-2nd-edition-6th-printing.pdf' },
        { type: 'cite', key: 'qb', text: t('Qin & Badgwell (2003). A survey of industrial model predictive control technology. Control Engineering Practice 11(7), §3.4.1.', 'Qin、Badgwell（2003）。A survey of industrial model predictive control technology。Control Engineering Practice 11(7)，§3.4.1。'), url: 'https://doi.org/10.1016/S0967-0661(02)00186-7' },
        { type: 'cite', key: 'pr', text: t('Pannocchia & Rawlings (2003). Disturbance models for offset-free model-predictive control. AIChE Journal 49(2).', 'Pannocchia、Rawlings（2003）。Disturbance models for offset-free model-predictive control。AIChE Journal 49(2)。'), url: 'https://doi.org/10.1002/aic.690490213' },
        { type: 'cite', key: 'mb', text: t('Muske & Badgwell (2002). Disturbance modeling for offset-free linear model predictive control. Journal of Process Control 12(5).', 'Muske、Badgwell（2002）。Disturbance modeling for offset-free linear model predictive control。Journal of Process Control 12(5)。'), url: 'https://doi.org/10.1016/S0959-1524(01)00051-8' },
      ],
    },
    // ------------------------------------------------------------------ estimation
    {
      id: 'kalman-why', kind: 'read', chapter: t('Estimating what you cannot measure', '估计测不到的东西'), title: t('Only the position is measured', '只测得到位置'),
      blocks: [
        { type: 'p', text: t(
          'The world above cheated: the controller read $p$ and $v$ exactly. A real cart has an encoder or GPS for position, with noise, and nothing for speed. MPC needs the whole state $x_0$ to plan from, and the $\\hat d$ update needs the speed. The obvious idea is to difference positions: $v \\approx (y_k - y_{k-1})/\\Delta t$.',
          '上面的交互其实作了弊：控制器能精确读到 $p$ 和 $v$。真实的小车靠编码器或 GPS 测位置，有噪声，速度则根本没人测。可 MPC 需要完整的状态 $x_0$ 作为规划起点，$\\hat d$ 的更新也要用到速度。最直接的想法是对位置做差分：$v \\approx (y_k - y_{k-1})/\\Delta t$。') },
        { type: 'p', text: t(
          'The standard answer is the Kalman filter[^kalman][^wb]: predict with the model, correct with the measurement, and weigh the two by how much you trust each. Kalman also showed that filtering is the dual of the regulator problem: a Riccati equation of the same form as M3’s LQR, run for estimation.',
          '标准答案是卡尔曼滤波[^kalman][^wb]：用模型预测，用测量修正，按各自有多可信给两者加权。Kalman 还证明了滤波和调节器问题是对偶的：一个和 M3 里 LQR 形式相同的 Riccati 方程，只是用来做估计。') },
        { type: 'cite', key: 'kalman', text: t('Kalman (1960). A New Approach to Linear Filtering and Prediction Problems. Journal of Basic Engineering 82(1).', 'Kalman（1960）。A New Approach to Linear Filtering and Prediction Problems。Journal of Basic Engineering 82(1)。'), url: 'https://doi.org/10.1115/1.3662552' },
        { type: 'cite', key: 'wb', text: t('Welch & Bishop (2004). An Introduction to the Kalman Filter. UNC Chapel Hill TR 95-041 (an accessible tutorial).', 'Welch、Bishop（2004）。An Introduction to the Kalman Filter。UNC Chapel Hill 技术报告 TR 95-041（入门教程）。'), url: 'https://techreports.cs.unc.edu/papers/95-041.pdf' },
      ],
    },
    {
      id: 'diff-predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'kalman', purpose: 'predict',
      prompt: t('Each position measurement has about 5 cm of random error, taken every $\\Delta t = 0.1$ s. Roughly how large is the error of the differenced speed $(y_k - y_{k-1})/\\Delta t$?', '每次位置测量带着约 5 cm 的随机误差，每 $\\Delta t = 0.1$ s 测一次。差分得到的速度 $(y_k - y_{k-1})/\\Delta t$，误差大概有多大？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('About 0.05 m/s', '约 0.05 m/s') },
        { id: 'b', label: t('About 0.7 m/s', '约 0.7 m/s'), correct: true },
        { id: 'c', label: t('About 5 m/s', '约 5 m/s') },
      ] },
      explain: t('Two independent 5 cm errors give about $5\\sqrt 2 \\approx 7$ cm, divided by 0.1 s: about 0.7 m/s, as large as the cart’s top cruising speed here. Dividing by a small $\\Delta t$ amplifies noise.', '两个独立的 5 cm 误差合起来约 $5\\sqrt 2 \\approx 7$ cm，再除以 0.1 s：约 0.7 m/s，和这里小车巡航的速度一样大。除以一个很小的 $\\Delta t$，会把噪声放大。'),
    },
    {
      id: 'kalman-scene', kind: 'scene', title: t('Predict, then correct', '先预测，再修正'),
      scene: vis('mpc_kalman'),
      narration: t(
        'Only the position is measured, with five centimetres of noise, and random pushes the model does not know act on the cart. § Top, in orange: the speed from differencing two measurements. It jumps by more than a metre per second; its error is about point eight. § Now the Kalman filter, in blue. Each step it predicts with the model, then corrects toward the measurement. Its speed error is about point one two, though it never measures speed. § On the right, one correction. The prediction and the measurement are both uncertain. § Combined, the estimate is narrower than either, and it moves twenty-nine percent of the way toward the measurement.',
        '只测位置，噪声五厘米；还有模型不知道的随机推力作用在小车上。§上面橙色的，是对两次测量做差分得到的速度。它一跳就是一米每秒以上，误差约零点八。§再看蓝色的卡尔曼滤波。每一步，它先用模型预测，再朝测量值修正。它从来没测过速度，速度误差却只有零点一二左右。§右边是一次修正。预测和测量各有不确定性；§两者合起来，估计比任何一个都更窄，而且朝测量值挪了百分之二十九的路。'),
    },
    {
      id: 'kalman', kind: 'derive', title: t('The two steps', '两个步骤'), skill: 'kalman',
      intro: t(
        'Every sample, two steps. $W$ is the covariance of the pushes the model cannot predict, $V$ that of the measurement noise. (Kalman-filter texts call them $Q$ and $R$; in this course $Q$ and $R$ are the cost weights.)',
        '每个采样时刻做两步。$W$ 是模型预测不到的推力的协方差，$V$ 是测量噪声的协方差。（讲卡尔曼滤波的资料管它们叫 $Q$ 和 $R$；在这门课里，$Q$ 和 $R$ 是代价的权重。）'),
      lines: [
        { tex: '\\hat x^-_k = A\\hat x_{k-1} + B u_{k-1}, \\qquad P^-_k = A P_{k-1} A^\\top + W', why: t('Predict: move the estimate with the model. Its uncertainty $P$ is carried along and grows by what the model cannot predict, $W$.', '预测：用模型把估计往前推一步。它的不确定性 $P$ 也跟着传过去，并且加上模型预测不到的那部分 $W$。') },
        { tex: 'L_k = P^-_k C^\\top \\left(C P^-_k C^\\top + V\\right)^{-1}', why: t('The gain: how much to trust the measurement, the prediction’s uncertainty against the sensor’s. For one position, $L_p = P^-/(P^- + V)$.', '增益：测量该信几分，就看预测的不确定性和传感器的不确定性谁大。只看位置时，$L_p = P^-/(P^- + V)$。') },
        { tex: '\\hat x_k = \\hat x^-_k + L_k\\,(y_k - C\\hat x^-_k), \\qquad P_k = (I - L_k C)\\,P^-_k', why: t('Correct: move toward the measurement by $L$ times the surprise, and the uncertainty shrinks. The speed entry of $L$ turns a position surprise into a speed correction: that is how it estimates what it never measures.', '修正：朝测量值移动"$L$ 乘以意外"那么多，不确定性随之缩小。$L$ 里对应速度的那一项，把位置上的意外转成对速度的修正：它就是这样估计出从没测过的量。') },
        { tex: 'L_p \\to 0.29', why: t('In the scene the gain settles to a constant: after a few steps the filter is a fixed linear correction.', '在刚才的动画里，增益很快稳定成常数：几步之后，滤波器就是一个固定的线性修正。') },
      ],
      blank: { line: 1, answer: 'P/(P+V)', variables: ['P', 'V'], prompt: t('The position gain $L_p$ when only the position is measured (write P for $P^-$).', '只测位置时的位置增益 $L_p$（用 P 表示 $P^-$）。') },
      outro: t(
        'Run the same filter on the augmented model $[x;\\ d]$ and it estimates the wind as well: this is how offset-free MPC gets $\\hat d$ when only $p$ is measured. $V$ is usually measured from sensor data; $W$ is harder to know and is often a tuning knob.',
        '把同一个滤波器用在增广模型 $[x;\\ d]$ 上，它连风也一起估计出来：只测 $p$ 时，无偏差 MPC 就是这样得到 $\\hat d$ 的。$V$ 通常可以用传感器数据测出来；$W$ 更难知道，常常当作一个调节旋钮。'),
    },
    // ------------------------------------------------------------------ robust
    {
      id: 'tube-why', kind: 'read', chapter: t('Pushes that keep changing', '不停变化的推力'), title: t('Leave room for what you cannot predict', '给预测不到的东西留余量'),
      blocks: [
        { type: 'p', text: t(
          'Offset-free MPC handles a push that stays. Some pushes do not stay: gusts that change every second or so, unknown but bounded, $|w| \\le \\bar w$. A plan that docks exactly at the wall has no room for them. Robust MPC asks for more: keep the limit for **every** push sequence within the bound.',
          '无偏差 MPC 对付的是一直存在的推力。有些推力不会一直在：每隔一秒左右就变一次的阵风，大小未知但有界，$|w| \\le \\bar w$。一个正好贴着墙停车的计划，没有给它们留任何余地。鲁棒 MPC 的要求更高：对界限内的**每一种**推力序列，都要守住约束。') },
        { type: 'p', text: t(
          'Planning against every sequence explicitly multiplies the constraints by the number of sequences, which the book notes can exceed $10^6$ in process plants[^rmd2]. Tube MPC[^langson][^mayne] avoids that: plan once for the nominal model, with limits tightened by a margin computed offline, and add a feedback that holds the real cart near the plan.',
          '把每一种序列都显式写进规划，约束个数就要乘上序列的个数；书里提到，在流程工业里这个数可以超过 $10^6$[^rmd2]。管道 MPC[^langson][^mayne] 绕开了这一点：只对名义模型规划一次，约束按离线算好的余量收紧，再加一个反馈，把真实的小车拉在计划附近。') },
        { type: 'cite', key: 'rmd2', text: t('Rawlings, Mayne & Diehl, Model Predictive Control, 2nd ed., §3.5 (Tube-Based Robust MPC).', 'Rawlings、Mayne、Diehl，Model Predictive Control，第 2 版，§3.5（Tube-Based Robust MPC）。'), url: 'https://sites.engineering.ucsb.edu/~jbraw/mpc/MPC-book-2nd-edition-6th-printing.pdf' },
        { type: 'cite', key: 'langson', text: t('Langson, Chryssochoos, Raković & Mayne (2004). Robust model predictive control using tubes. Automatica 40(1).', 'Langson、Chryssochoos、Raković、Mayne（2004）。Robust model predictive control using tubes。Automatica 40(1)。'), url: 'https://doi.org/10.1016/j.automatica.2003.08.009' },
        { type: 'cite', key: 'mayne', text: t('Mayne, Seron & Raković (2005). Robust model predictive control of constrained linear systems with bounded disturbances. Automatica 41(2).', 'Mayne、Seron、Raković（2005）。Robust model predictive control of constrained linear systems with bounded disturbances。Automatica 41(2)。'), url: 'https://doi.org/10.1016/j.automatica.2004.08.019' },
      ],
    },
    {
      id: 'tube-predict', kind: 'checkpoint', title: t('Guess first', '先猜一猜'), skill: 'tube', purpose: 'predict',
      prompt: t('A feedback keeps each of 12 runs within 18 cm of a docking plan that ends exactly at the wall. Roughly how many runs cross the wall?', '一个反馈把 12 次运行都拉在计划附近 18 cm 以内，而这个停车计划的终点正好贴着墙。大概有几次会越过墙？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('None: the feedback keeps them on the plan', '一次也没有：反馈把它们拉在计划上'), misconception: 'feedback-is-enough' },
        { id: 'b', label: t('Around half', '大约一半'), correct: true },
        { id: 'c', label: t('All 12', '全部 12 次') },
      ] },
      explain: t('Within 18 cm of a plan that touches the wall means up to 18 cm on either side of it. Every run that ends on the outer side crosses. The scene shows it.', '离一个贴墙的计划 18 cm 以内，意味着两边都可能偏 18 cm。凡是停在外侧的运行，都会越过墙。看动画。'),
    },
    {
      id: 'tube-scene', kind: 'scene', title: t('A tube around the plan', '计划外面的一根管子'),
      scene: vis('mpc_tube'),
      narration: t(
        'Twelve random push histories, each up to zero point one five metres per second squared, either way. § Left: just carry out the docking plan. The errors pile up, and four of the twelve runs cross the wall. § Middle: add a feedback that pulls the cart back toward the plan. Now every run stays within eighteen centimetres of the plan: the shaded tube. § But the plan ends right at the wall, so runs on the outer side cross it: eight of twelve. § Right: the same feedback, with the plan’s wall moved in by the tube’s width. § No run crosses.',
        '十二种随机的推力历程，每一种最大零点一五米每二次方秒，方向不定。§左边：只是照着停车计划执行。误差越积越多，十二次里有四次越过了墙。§中间：加上一个把小车拉回计划的反馈。现在每一次运行都在计划上下十八厘米以内，也就是那根阴影管子。§可是计划的终点正好贴着墙，所以停在外侧的那些都越过了墙：十二次里有八次。§右边：同样的反馈，只是计划用的墙往里收了一个管子的宽度。§一次都没有越过。'),
    },
    {
      id: 'tube', kind: 'derive', title: t('Why there is a tube, and how wide', '管子从哪来，有多宽'), skill: 'tube',
      intro: t('Split the input into the plan’s part and a correction:', '把输入拆成计划给的部分和一个修正：'),
      lines: [
        { tex: 'u = \\bar u - K\\,(x - \\bar x)', why: t('$\\bar x$, $\\bar u$: the nominal plan, made with the model and no push. The feedback acts only on the deviation from it. (The book writes $+K$ with the sign inside $K$.)', '$\\bar x$、$\\bar u$：名义计划，用不带推力的模型算出来。反馈只作用在偏离计划的那部分上。（书里写成 $+K$，负号放在 $K$ 里面。）') },
        { tex: 'e = x - \\bar x:\\qquad e^+ = (A - BK)\\,e + B w = A_K e + B w', why: t('The error obeys its own small system, driven only by the push $w$. The plan cancels out.', '误差服从它自己的一个小系统，只由推力 $w$ 驱动。计划被消掉了。') },
        { tex: 'K = 0:\\quad A_K = A,\\qquad |e_k| \\to \\infty', why: t('Open loop the error grows without bound: the cart adds pushes into speed and speed into position. That is the left panel.', '开环时误差会无限增长：小车把推力累加成速度，又把速度累加成位置。这就是左边那幅图。') },
        { tex: 'S = \\sum_{j \\ge 0} A_K^{\\,j} B\\,[-\\bar w,\\ \\bar w]:\\quad |e_p| \\le 0.18\\ \\text{m},\\ |e_v| \\le 0.15\\ \\text{m/s},\\ |K e| \\le 0.22\\ \\text{m/s}^2', why: t('With a stable $A_K$ every past push is damped, and the error stays in the set $S$: the tube’s cross-section, computed once, offline. (Numbers for $\\bar w = 0.15$ and this cart’s $K$.)', '$A_K$ 稳定时，过去的每一次推力都会衰减，误差就一直留在集合 $S$ 里：这就是管子的横截面，离线算一次就行。（数字对应 $\\bar w = 0.15$ 和这辆小车的 $K$。）') },
        { tex: '\\bar{\\mathcal X} = \\mathcal X \\ominus S, \\qquad \\bar{\\mathcal U} = \\mathcal U \\ominus K S', why: t('Tighten: the plan stays 0.18 m from the wall, 0.15 m/s under the speed limit and 0.22 m/s² under the acceleration limit, leaving the feedback its room. If the plan keeps the tightened limits, the real cart keeps the real ones for every push up to $\\bar w$.', '收紧：计划离墙留 0.18 m，速度比上限低 0.15 m/s，加速度比上限低 0.22 m/s²，把余量留给反馈。只要计划守住收紧后的约束，真实的小车对界限内的每一种推力都守得住原来的约束。') },
      ],
      outro: t(
        'The price: you must know a bound $\\bar w$, and the plan is conservative for the typical push. And the real state converges to the tube around the target, not to the target itself.',
        '代价是：你得知道一个上界 $\\bar w$；对通常大小的推力，这个计划偏保守。而且真实状态收敛到的是目标周围的那根管子，而不是目标本身。'),
    },
    // ------------------------------------------------------------------ code
    {
      id: 'code', kind: 'code', chapter: t('In code', '代码'), title: t('Offset-free MPC in 40 lines', '40 行写出无偏差 MPC'),
      intro: t(
        'The whole loop with cvxpy: the steady target, the MPC with $\\hat d$ in its model, and the estimate. Like the world, it reads $p$ and $v$ exactly; with only $p$ measured, replace line 38 by a Kalman filter on the augmented model. Run with cvxpy 1.8.2.',
        '用 cvxpy 写完整个回路：稳态目标、模型里带 $\\hat d$ 的 MPC，以及估计。和交互里一样，它能精确读到 $p$ 和 $v$；如果只测 $p$，把第 38 行换成增广模型上的卡尔曼滤波。用 cvxpy 1.8.2 跑过。'),
      lang: 'python', code: OFFSET_FREE_CODE,
      notes: [
        { lines: [9, 11], text: t('The cart, the weights and the terminal cost from M3: $Q = \\text{diag}(1, 0)$, $R = 0.1$, $N = 20$, $P$ = the LQR cost-to-go.', '小车、权重和终端代价都沿用 M3：$Q = \\text{diag}(1, 0)$，$R = 0.1$，$N = 20$，$P$ 取 LQR 的代价函数。') },
        { lines: [13, 17], text: t('The steady target: where the model with $\\hat d$ can rest at the flag. It returns $x_s = (6, 0)$ and $u_s = -\\hat d$.', '稳态目标：带 $\\hat d$ 的模型在旗子处停得住的状态和输入。返回 $x_s = (6, 0)$ 和 $u_s = -\\hat d$。') },
        { lines: [19, 29], text: t('The MPC: the model includes $\\hat d$ (line 25), and the cost penalises distance to the target $(x_s, u_s)$, not to the flag and zero push.', 'MPC：模型里带着 $\\hat d$（第 25 行），代价惩罚的是离目标 $(x_s, u_s)$ 的距离，而不是离旗子和零推力的距离。') },
        { lines: [33, 36], text: t('The loop: the model expects $u + \\hat d$, the real cart gets $u + d$.', '回路：模型以为加速度是 $u + \\hat d$，真实小车得到的是 $u + d$。') },
        { lines: [37, 38], text: t('The estimate: take in 20% of the acceleration the model missed. Without it (`estimate=False`) this is the nominal MPC.', '估计：吸收模型漏算的加速度的 20%。去掉它（`estimate=False`）就是名义 MPC。') },
        { lines: [41, 43], text: t('Output: `nominal: offset -10.8 cm` and `offset-free: offset 0.0 cm, d_hat = -0.300`, the same numbers as the world.', '输出：`nominal: offset -10.8 cm` 和 `offset-free: offset 0.0 cm, d_hat = -0.300`，与交互里的数字一致。') },
      ],
    },
    // ------------------------------------------------------------------ checks
    {
      id: 'q-drone', kind: 'checkpoint', chapter: t('Check', '检验'), title: t('A drone that sags', '下沉的无人机'), skill: 'offset-cause', purpose: 'check',
      prompt: t('A drone holds its altitude with an MPC whose model does not include a camera someone added. At rest its altitude gain is $K_p = 2.5$ s⁻², and the extra weight pulls it down with $d = -0.5$ m/s². How many centimetres below the setpoint does it hover?', '一架无人机用 MPC 定高，模型里没有算上后来加装的相机。停稳时它的高度增益 $K_p = 2.5$ s⁻²，多出来的重量以 $d = -0.5$ m/s² 把它往下拉。它悬停在设定高度下方多少厘米？'),
      question: { type: 'number', answer: 20, tolerance: 0.5, unit: t('cm', 'cm'), wrong: [
        { answer: 125, feedback: t('That is $d \\times K_p$. The resting error is $d / K_p$: the gain has to turn the error into the push, so a bigger gain needs less error.', '这是 $d \\times K_p$。停住时的误差是 $d / K_p$：增益要把误差变成推力，增益越大，需要的误差越小。') },
        { answer: 0, misconception: 'replan-removes-offset', feedback: t('Re-planning starts each plan from the measured altitude, but every plan uses the same model without the camera, so it rests where the law balances the weight.', '重新规划会从测到的高度出发，但每次规划用的都是没算相机的同一个模型，所以它停在反馈律刚好托住这份重量的地方。') },
      ] },
      explain: t('$e = d / K_p = -0.5 / 2.5 = -0.2$ m: 20 cm low. A disturbance estimate (offset-free MPC) removes it.', '$e = d / K_p = -0.5 / 2.5 = -0.2$ m：低了 20 cm。加上扰动估计（无偏差 MPC）就能消掉。'),
    },
    {
      id: 'q-bias', kind: 'checkpoint', title: t('A quick fix', '一个省事的改法'), skill: 'disturbance-placement', purpose: 'check',
      prompt: t('To remove the cart’s offset, a colleague adds an output bias to the model, $y = p + d$, $d$ constant, and estimates $d$ from the position measurements. What happens?', '为了消掉小车的偏差，同事给模型加了一个输出偏置 $y = p + d$（$d$ 为常数），再用位置测量去估计 $d$。会怎样？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('It works: any integrating disturbance gives integral action', '能行：任何积分型扰动都能提供积分作用'), misconception: 'bias-always-works' },
        { id: 'b', label: t('The estimator cannot tell a bias from a cart resting elsewhere, so the offset is not reliably removed', '估计器分不清"偏置"和"小车停在别处"，所以偏差不一定能消掉'), correct: true },
        { id: 'c', label: t('It works if the estimate gain λ is large enough', '只要估计增益 λ 足够大就行') },
        { id: 'd', label: t('It works if $q$ is raised as well', '再把 $q$ 调大就行'), misconception: 'q-removes-offset' },
      ] },
      explain: t('With $B_d = 0$, $C_d = 1$ the rank test gives 2 instead of 3: not detectable. A cart can rest anywhere, so "the sensor is off by 10 cm" and "the cart is 10 cm short" look identical. Model the push on the acceleration ($B_d = B$) instead.', '取 $B_d = 0$、$C_d = 1$ 时，秩判据给出 2 而不是 3：不可检测。小车停在哪里都行，所以"传感器差了 10 cm"和"小车差了 10 cm"看起来一模一样。应该把推力建在加速度上（$B_d = B$）。'),
    },
    {
      id: 'q-noise', kind: 'checkpoint', title: t('A cheaper sensor', '换个便宜的传感器'), skill: 'kalman', purpose: 'check',
      prompt: t('You switch to a cheaper position sensor with three times the noise, and set $V$ to match. What does the Kalman filter do differently?', '你换了一个便宜的位置传感器，噪声是原来的三倍，$V$ 也相应调大了。卡尔曼滤波的表现会有什么不同？'),
      question: { type: 'choice', options: [
        { id: 'a', label: t('A smaller gain $L$: it leans on the model, so the estimate is smoother but reacts more slowly to real changes', '增益 $L$ 变小：更依赖模型，估计更平滑，但对真实变化反应更慢'), correct: true },
        { id: 'b', label: t('A larger gain $L$: it follows the measurements more closely to make up for the noise', '增益 $L$ 变大：更紧地跟着测量走，来弥补噪声'), misconception: 'noise-raises-gain' },
        { id: 'c', label: t('The same gain: $L$ depends only on the model', '增益不变：$L$ 只取决于模型') },
        { id: 'd', label: t('It ignores the measurements from then on', '从此不再理会测量') },
      ] },
      explain: t('$L_p = P^-/(P^- + V)$: a larger $V$ gives a smaller gain. Each correction moves less toward the noisy measurement, which smooths the estimate and also delays it.', '$L_p = P^-/(P^- + V)$：$V$ 越大，增益越小。每次修正朝噪声大的测量挪得更少，估计更平滑，也更滞后。'),
    },
    {
      id: 'q-choose', kind: 'checkpoint', title: t('Which fix?', '用哪种办法？'), skill: 'tube', purpose: 'check',
      prompt: t('For each case, offset-free MPC or tube MPC, and why? (a) A conveyor whose load changes slowly over the day must stop within a few millimetres of a mark. (b) A robot arm next to a person must never cross a safety plane, under gusts and bumps of known maximum size.', '下面两种情况，分别该用无偏差 MPC 还是管道 MPC？为什么？（a）一条传送带，负载一天里慢慢变化，必须停在标记处几毫米以内。（b）人旁边的机械臂，在已知最大幅度的阵风和磕碰下，绝不能越过一个安全平面。'),
      question: { type: 'text', placeholder: t('(a) … because … (b) … because …', '（a）……因为……（b）……因为……'), rubric: {
        key_points: [
          t('(a) Offset-free MPC: a persistent unknown push (the load) leaves a steady offset, which an estimated integrating disturbance and a shifted target remove.', '（a）无偏差 MPC：持续存在的未知推力（负载）会留下稳态偏差，用估计出的积分型扰动加上移动后的目标就能消掉。'),
          t('(b) Tube MPC: the pushes are bounded but keep changing, and the limit is hard; tightening the plan’s limits by the tube width plus feedback guarantees it for every push up to the bound.', '（b）管道 MPC：推力有界但不停变化，约束是硬的；按管子宽度收紧计划的约束，再加上反馈，就能对界限内的每一种推力都保证不越界。'),
        ],
        model_answer: t('(a) Offset-free MPC: the slowly changing load is a push that stays, so a plain MPC would stop short; estimating it as a disturbance and shifting the target gives zero offset. (b) Tube MPC: the gusts change and only their bound is known, and the plane must never be crossed, so plan with the limit moved in by the tube width and let the feedback keep the arm inside the tube.', '（a）无偏差 MPC：慢慢变化的负载是一股一直存在的推力，普通 MPC 会停不到位；把它当扰动估计出来、移动目标，就没有偏差。（b）管道 MPC：阵风在变，只知道上界，而安全平面绝不能越过，所以规划时把约束往里收一个管子的宽度，再由反馈把机械臂留在管子里。'),
        min_points: 2,
      } },
    },
    // ------------------------------------------------------------------ choose
    {
      id: 'in-practice', kind: 'read', chapter: t('How to choose', '怎么选'), title: t('What to use when', '什么时候用什么'),
      blocks: [
        { type: 'table', head: [t('Situation', '情况'), t('Use', '用什么'), t('Watch out', '注意')], rows: [
          [t('Any real plant (there is always a push you did not model)', '任何真实对象（总有没建模的推力）'), t('offset-free MPC: disturbance estimate + steady target', '无偏差 MPC：扰动估计 + 稳态目标'), t('put $d$ where the real push enters; an output bias fails for integrators; $n_d = p$', '$d$ 加在真实推力作用的地方；对积分型对象，输出偏置不行；$n_d = p$')],
          [t('States you cannot measure, or noisy sensors', '有测不到的状态，或传感器噪声大'), t('a Kalman filter on the augmented model $[x;\\ d]$', '增广模型 $[x;\\ d]$ 上的卡尔曼滤波'), t('measure $V$ from data; tune $W$: larger means trust the model less', '$V$ 用数据测；$W$ 当旋钮调：越大越不信模型')],
          [t('Hard limits that must hold under bounded, changing pushes', '有界且变化的推力下，必须守住的硬约束'), t('tube MPC: tightened limits + feedback', '管道 MPC：收紧的约束 + 反馈'), t('needs a bound $\\bar w$; conservative; converges to a tube, not a point', '需要上界 $\\bar w$；偏保守；收敛到管子而不是一个点')],
        ] },
        { type: 'p', text: t(
          'In practice the first row is the default. Qin & Badgwell’s survey of industrial MPC describes the feedback those packages use: a bias update (the output-disturbance version), and its failure for integrating plants[^qb2]. None of the three fixes a model that is wrong enough to make the loop unstable; that question, robust stability, is treated in RMD chapter 3. Next, M8: what to do when the model is not even linear.',
          '实践中，第一行是默认配置。Qin 和 Badgwell 对工业 MPC 的综述描述了这些软件用的反馈：偏置更新（输出扰动的版本），以及它在积分型对象上的失效[^qb2]。三种办法都救不了一个错到让闭环失稳的模型；那是鲁棒稳定性的问题，见 RMD 第 3 章。下一课 M8：模型连线性都不是时怎么办。') },
        { type: 'cite', key: 'qb2', text: t('Qin & Badgwell (2003). A survey of industrial model predictive control technology. Control Engineering Practice 11(7).', 'Qin、Badgwell（2003）。A survey of industrial model predictive control technology。Control Engineering Practice 11(7)。'), url: 'https://doi.org/10.1016/S0967-0661(02)00186-7' },
      ],
    },
  ],
};
