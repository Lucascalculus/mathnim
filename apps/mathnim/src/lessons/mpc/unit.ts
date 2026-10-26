// The model predictive control course's units (docs/lessons/mpc). Each lesson's agent
// fills in its own two lines (the import and its entry) once its lesson passes the doctor,
// re-reading this file right before editing (other agents edit it too), then runs
// `npm run manifest -w mathnim`. Batch 1 = M1-M4 (published first), batch 2 = M5-M8.
import type { CourseLesson, Unit } from '../../course';
import { t } from './common';
// ---- imports (one per lesson; uncomment and fix the file name when the lesson exists)
import { lesson as m1 } from './m1_lookahead';
import { lesson as m2 } from './m2_model';
import { lesson as m3 } from './m3_cost';
import { lesson as m4 } from './m4_constraints';
import { lesson as m5 } from './m5_solving';
import { lesson as m6 } from './m6_feasibility';
import { lesson as m7 } from './m7_disturbances';
import { lesson as m8 } from './m8_nmpc';

/** One entry: `{ id: mN.id, lesson: mN, minutes, thumb: '<step id>', title: t(en, zh), summary: t(en, zh) }`. */
const basics: CourseLesson[] = [
  // M1
  { id: m1.id, lesson: m1, minutes: 30, thumb: 'loop', title: t('Look ahead, then act', '往前看再动手'), summary: t('Why reacting to the error cannot respect limits, the MPC loop (plan N steps, apply the first, re-plan), and how far ahead it must look.', '只对误差做反应为什么守不住限制；MPC 的循环（规划 N 步、执行第一步、重新规划）；以及要往前看多远。') },
  // M2
  { id: m2.id, lesson: m2, minutes: 30, thumb: 'dock-world', title: t('The model: from physics to prediction', '模型：从物理到预测'), summary: t('Discretize the cart exactly, predict a whole plan with X = Φx₀ + ΓU, and see why linear predictions make MPC a QP.', '把小车精确离散化，用 X = Φx₀ + ΓU 预测整个计划，并看清线性预测为什么让 MPC 成为 QP。') },
  // M3
  { id: m3.id, lesson: m3, minutes: 30, thumb: 'r-sweep', title: t('The cost: saying what you want', '代价：想要什么'), summary: t('Weights are prices, not limits: what Q and R buy, why the unconstrained plan is a fixed feedback gain, and how the horizon and terminal cost lead to LQR.', '权重是价格，不是上限：Q 和 R 各买到什么，为什么无约束的计划就是固定的反馈增益，时域和终端代价怎样通向 LQR。') },
];
const constraints: CourseLesson[] = [
  // M4
  { id: m4.id, lesson: m4, minutes: 30, thumb: 'qp-scene', title: t('Constraints: writing the limits in', '约束：把限制写进去'), summary: t('Limits turn MPC into a quadratic program: the best plan is where the smallest cost ellipse touches the allowed polygon, clipping is not solving, and the law becomes piecewise affine.', '限制把 MPC 变成二次规划：最好的计划在最小的代价椭圆碰到允许多边形的地方；截断不等于求解；控制律变成分段仿射的。') },
  { id: m5.id, lesson: m5, minutes: 35, thumb: 'paths', title: t('Solving: fast enough, every step', '求解：每一步都要解得够快'), summary: t('The QP must be solved every sample, worst case included: condensed versus sparse, active set, interior point and ADMM, warm starting from the last plan, and what to do when the solver is late.', 'QP 每个采样都要重解，最慢的那次也得按时：稠密与稀疏两种写法，有效集法、内点法和 ADMM，从上一份计划热启动，以及求解器迟到时怎么办。') },
  // M6
  { id: m6.id, lesson: m6, minutes: 30, thumb: 'trap-scene', title: t('Stability and feasibility: the price of short sight', '稳定与可行：短视的代价'), summary: t('Why a short horizon crashes although every QP had a solution, how a terminal set keeps every later QP solvable, what the terminal cost adds, and soft constraints for limits a disturbance can break.', '为什么短时域每个 QP 都有解却还是撞墙；终端集怎样让之后的每个 QP 都有解；终端代价又补上了什么；以及扰动可能打破的限制怎样用软约束处理。') },
];
const real: CourseLesson[] = [
  // M7
  { id: m7.id, lesson: m7, minutes: 35, thumb: 'offset-scene', title: t('When the model is wrong', '模型不准时'), summary: t('Why an unknown steady push leaves an offset however you tune, how estimating it removes the offset (integral action), what a Kalman filter adds, and how tube MPC keeps hard limits under changing pushes.', '模型不知道的恒定推力为什么怎么调都留下偏差，把它估计出来为什么就能消掉（积分作用），卡尔曼滤波补上了什么，管道 MPC 怎样在变化的推力下守住硬约束。') },
  // M8
  { id: m8.id, lesson: m8, minutes: 35, thumb: 'world', title: t('Nonlinear MPC, and how to choose', '非线性 MPC 与怎么选'), summary: t('When the model is nonlinear: shooting, one QP at a time (SQP), why the real-time iteration needs only one QP per sample if it starts from the last plan, tools and real uses, and a card for choosing PID, LQR, MPC, nonlinear MPC or RL.', '模型非线性时怎么办：打靶法、一次解一个 QP（SQP）、为什么实时迭代从上一个计划出发时每个采样只需一个 QP、工具与真实应用，以及在 PID、LQR、MPC、非线性 MPC 和强化学习之间做选择的卡片。') },
];

export const units: Unit[] = [
  { id: 'mpc-basics', title: t('Basics', '基础'), lessons: basics },
  { id: 'mpc-constraints', title: t('Constraints and solving', '约束与求解'), lessons: constraints },
  { id: 'mpc-real', title: t('Real systems', '真实系统'), lessons: real },
].filter((u) => u.lessons.length > 0);
