// Formulas read block by block and layer by layer (lib/parts.ts): what a learner needs to see to find the intuition in
// a formula from AI, mathematics and physics. A block is several terms that mean one thing (the error, the average,
// the share of the total); a block opens into the blocks it is made of. Each formula is written in the form whose
// blocks carry the idea (the quadratic formula as middle ± distance, not over one bar), as an author should.
import type { FormulaPart } from '../../src/lib/parts';

const t = (en: string, zh: string) => ({ en, zh });
const P = (tex: string, says: { en: string; zh: string }, parts?: FormulaPart[]): FormulaPart => ({ tex, says, ...(parts ? { parts } : {}) });

export const FORMULAS: { id: string; field: 'ai' | 'math' | 'physics'; tex: string; parts: FormulaPart[] }[] = [
  // ---------------------------------------------------------------- AI
  { id: 'softmax', field: 'ai', tex: '\\sigma(z)_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}', parts: [
    P('\\sigma(z)_i', t('the probability given to class i', '分给第 i 类的概率')),
    P('\\frac{e^{z_i}}{\\sum_j e^{z_j}}', t("score i's share of the whole", '第 i 个分数在总量里的份额'), [
      P('e^{z_i}', t('the score made positive; bigger stays bigger', '把分数变成正数，大的仍然大')),
      P('\\sum_j e^{z_j}', t('the same for every score, added up: the shares sum to 1', '每个分数都这样变再加起来：份额总和是 1'))])] },
  { id: 'attention', field: 'ai', tex: '\\mathrm{Attention}(Q,K,V) = \\mathrm{softmax}\\!\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)V', parts: [
    P('\\mathrm{softmax}\\!\\left(\\frac{QK^\\top}{\\sqrt{d_k}}\\right)', t('how much each word looks at every other word (each row sums to 1)', '每个词看其他每个词的程度（每行加起来是 1）'), [
      P('QK^\\top', t('how well each query matches each key', '每个查询和每个键有多匹配')),
      P('\\sqrt{d_k}', t('keeps the scores from growing with the vector size', '让分数不随向量变长而变大'))]),
    P('V', t('what each word has to offer', '每个词能提供的内容'))] },
  { id: 'cross_entropy', field: 'ai', tex: 'L = \\sum_i y_i\\,(-\\log p_i)', parts: [
    P('y_i', t('1 for the right answer, 0 for the rest: only the right answer counts', '正确答案是 1，其余是 0：只有正确答案算数')),
    P('(-\\log p_i)', t('the surprise: large when the right answer got little probability', '惊讶程度：正确答案分到的概率越小，它越大'), [
      P('p_i', t('the probability the model gave class i', '模型给第 i 类的概率'))])] },
  { id: 'gradient_step', field: 'ai', tex: '\\theta \\leftarrow \\theta - \\eta\\,\\nabla L(\\theta)', parts: [
    P('\\theta - \\eta\\,\\nabla L(\\theta)', t('the new parameters: one step downhill from the old', '新参数：从旧参数往下坡走一步'), [
      P('\\theta', t('where you are now', '现在的位置')),
      P('\\eta\\,\\nabla L(\\theta)', t('the step, taken against the slope', '这一步，逆着坡的方向'), [
        P('\\eta', t('how big a step', '步子多大')),
        P('\\nabla L(\\theta)', t('the direction in which the loss rises fastest', '损失上升最快的方向'))])])] },
  { id: 'lora', field: 'ai', tex: 'W = W_0 + BA', parts: [
    P('W_0', t('the pretrained weights, frozen', '预训练好的权重，冻结不动')),
    P('BA', t('the change that is learned: low rank, so few numbers', '学出来的改变：低秩，所以参数很少'), [
      P('B', t('d × r, with r small', 'd × r，r 很小')),
      P('A', t('r × k', 'r × k'))])] },
  { id: 'kl', field: 'ai', tex: 'D_{\\mathrm{KL}}(p\\,\\|\\,q) = \\sum_x p(x)\\log\\frac{p(x)}{q(x)}', parts: [
    P('\\sum_x p(x)', t('averaged over what really happens (p)', '按真实发生的情况（p）取平均')),
    P('\\log\\frac{p(x)}{q(x)}', t('how much more surprised q is than p at x', '在 x 处 q 比 p 多惊讶多少'))] },
  { id: 'adam', field: 'ai', tex: 'm_t = \\beta_1 m_{t-1} + (1-\\beta_1)\\,g_t', parts: [
    P('\\beta_1 m_{t-1} + (1-\\beta_1)\\,g_t', t('a running average of the gradients', '梯度的滑动平均'), [
      P('\\beta_1 m_{t-1}', t('most of the old average (β₁ ≈ 0.9)', '旧平均的大部分（β₁ ≈ 0.9）')),
      P('(1-\\beta_1)\\,g_t', t('a little of the new gradient', '新梯度的一小部分'))])] },
  { id: 'bayes', field: 'ai', tex: 'P(A\\mid B) = \\frac{P(B\\mid A)\\,P(A)}{P(B)}', parts: [
    P('P(A\\mid B)', t('how likely A is, now that B is seen', '看到 B 之后，A 有多可能')),
    P('\\frac{P(B\\mid A)\\,P(A)}{P(B)}', t("the share of B's cases in which A also holds", '在 B 发生的情况里，A 也成立的份额'), [
      P('P(B\\mid A)\\,P(A)', t('how often A and B happen together', 'A 和 B 一起发生有多常见'), [
        P('P(B\\mid A)', t('how likely B is if A is true', 'A 成立时 B 有多可能')),
        P('P(A)', t('how common A is before any evidence', '没看证据前 A 有多常见'))]),
      P('P(B)', t('how often B happens at all', 'B 总共有多常见'))])] },
  { id: 'mse', field: 'ai', tex: 'L = \\frac{1}{n}\\sum_i (\\hat y_i - y_i)^2', parts: [
    P('\\frac{1}{n}\\sum_i', t('the average over all n points', '对全部 n 个点取平均')),
    P('(\\hat y_i - y_i)^2', t("point i's miss, squared: big misses count far more", '第 i 个点的偏差平方：大的偏差算得多得多'), [
      P('\\hat y_i - y_i', t('the miss: prediction minus truth', '偏差：预测减去真实值'))])] },
  // ---------------------------------------------------------------- mathematics
  { id: 'quadratic', field: 'math', tex: 'x = -\\frac{b}{2a} \\pm \\frac{\\sqrt{b^2 - 4ac}}{2a}', parts: [
    P('-\\frac{b}{2a}', t("the middle: the parabola's axis", '正中间：抛物线的对称轴')),
    P('\\pm \\frac{\\sqrt{b^2 - 4ac}}{2a}', t('how far each root lies from the middle', '每个根离正中间多远'), [
      P('b^2 - 4ac', t('negative means no real roots', '它小于 0 就没有实根'))])] },
  { id: 'taylor', field: 'math', tex: "f(x) \\approx f(a) + f'(a)(x-a) + \\frac{f''(a)}{2}(x-a)^2", parts: [
    P('f(a)', t('start from the value at a', '从 a 处的值出发')),
    P("f'(a)(x-a)", t('follow the tangent: slope times distance', '沿切线走：斜率乘距离')),
    P("\\frac{f''(a)}{2}(x-a)^2", t('then bend with the curvature', '再按弯曲程度弯一点'))] },
  { id: 'derivative', field: 'math', tex: "f'(x) = \\lim_{h\\to 0}\\frac{f(x+h)-f(x)}{h}", parts: [
    P('\\lim_{h\\to 0}', t('let the run shrink to nothing', '让水平距离缩到零')),
    P('\\frac{f(x+h)-f(x)}{h}', t('the slope of a secant', '割线的斜率'), [
      P('f(x+h)-f(x)', t('the rise', '升高多少')),
      P('h', t('the run', '水平走多少'))])] },
  { id: 'normal', field: 'math', tex: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}}\\,e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}', parts: [
    P('\\frac{1}{\\sigma\\sqrt{2\\pi}}', t('makes the whole area 1', '让总面积等于 1')),
    P('e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}', t('falls fast as x leaves the mean', 'x 离开均值时迅速变小'), [
      P('(x-\\mu)^2', t('the squared distance from the mean', '离均值距离的平方')),
      P('2\\sigma^2', t('measured against the spread', '用离散程度来衡量'))])] },
  { id: 'euler', field: 'math', tex: 'e^{i\\theta} = \\cos\\theta + i\\sin\\theta', parts: [
    P('\\cos\\theta', t('how far along the real axis', '沿实轴走多远')),
    P('i\\sin\\theta', t('how far up the imaginary axis', '沿虚轴往上走多远'))] },
  { id: 'by_parts', field: 'math', tex: '\\int u\\,dv = uv - \\int v\\,du', parts: [
    P('uv', t('the product, taken at the ends', '两端处的乘积')),
    P('\\int v\\,du', t('take away what came from u changing', '减去 u 变化带来的那部分'))] },
  { id: 'fourier', field: 'math', tex: 'X(f) = \\int x(t)\\,e^{-2\\pi i f t}\\,dt', parts: [
    P('\\int x(t)\\,e^{-2\\pi i f t}\\,dt', t("add it all up: where the wound signal's centre of mass lands", '全部加起来：缠绕后的信号的重心落在哪里'), [
      P('x(t)\\,e^{-2\\pi i f t}', t('the signal wound around a circle', '把信号缠到一个圆上'), [
        P('e^{-2\\pi i f t}', t('spin around the circle at frequency f', '以频率 f 绕圆旋转'))])])] },
  // ---------------------------------------------------------------- physics
  { id: 'kinematics', field: 'physics', tex: 'x = x_0 + v_0 t + \\tfrac{1}{2} a t^2', parts: [
    P('x_0', t('where it starts', '起点')),
    P('v_0 t', t('coasting at the starting speed', '按初速度匀速走的距离')),
    P('\\tfrac{1}{2} a t^2', t('the extra from speeding up', '加速多走的那一段'))] },
  { id: 'gravity', field: 'physics', tex: 'F = G\\,\\frac{m_1 m_2}{r^2}', parts: [
    P('G', t('how strong gravity is (tiny)', '引力有多强（非常小）')),
    P('\\frac{m_1 m_2}{r^2}', t('what this pair of bodies brings', '这一对物体带来的部分'), [
      P('m_1 m_2', t('both masses: double either, double the pull', '两个质量：任一个加倍，引力加倍')),
      P('r^2', t('spread over a sphere: twice as far, a quarter of the pull', '摊在球面上：距离加倍，引力变成四分之一'))])] },
  { id: 'oscillator', field: 'physics', tex: 'x(t) = A\\cos(\\omega t + \\varphi)', parts: [
    P('A', t('how far it swings', '摆动的幅度')),
    P('\\omega t + \\varphi', t('where in the swing it is: an angle', '摆到哪里：一个角度'), [
      P('\\omega t', t('turning at ω radians a second', '每秒转 ω 弧度')),
      P('\\varphi', t('where it started', '起始位置'))])] },
  { id: 'schrodinger', field: 'physics', tex: 'i\\hbar\\frac{\\partial\\psi}{\\partial t} = -\\frac{\\hbar^2}{2m}\\nabla^2\\psi + V\\psi', parts: [
    P('i\\hbar\\frac{\\partial\\psi}{\\partial t}', t('how ψ changes in time', 'ψ 随时间怎么变')),
    P('-\\frac{\\hbar^2}{2m}\\nabla^2\\psi', t('kinetic energy: how sharply ψ bends', '动能：ψ 弯得多厉害')),
    P('V\\psi', t('potential energy where the particle is', '粒子所在处的势能'))] },
  { id: 'lorentz', field: 'physics', tex: '\\gamma = \\frac{1}{\\sqrt{1 - v^2/c^2}}', parts: [
    P('\\sqrt{1 - v^2/c^2}', t('shrinks toward 0 as v nears c', 'v 接近 c 时缩向 0'), [
      P('v^2/c^2', t("speed as a share of light's, squared", '速度占光速的比例，再平方'))])] },
  { id: 'work_energy', field: 'physics', tex: 'W = \\tfrac{1}{2} m v^2 - \\tfrac{1}{2} m v_0^2', parts: [
    P('\\tfrac{1}{2} m v^2', t('kinetic energy now', '现在的动能')),
    P('\\tfrac{1}{2} m v_0^2', t('kinetic energy at the start', '开始时的动能'))] },
];
