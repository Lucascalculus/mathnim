# Course: 模型预测控制（MPC）/ Model Predictive Control

Requested by the user on 2026-10-26: "publish一门课仔细讲一下mpc". They chose
Model Predictive Control, for university students and engineers, 6–8 lessons.

The standards are the same as the LLM fine-tuning course. Read these first:
- `docs/lessons/llm-finetuning/BUILD.md`: the build brief, ownership rules, and
  the only acceptance criterion, 讲明白.
- `docs/lessons/llm-finetuning/INTERACTION-BAR.md`: what every world must have.
  Use toolkit features only where they truly add meaning.
- `docs/SITE-STRUCTURE.md`: course page, outline, side chat, labs.

Key rules:
- **Understanding first.** Purpose and intuition come before math, and math
  before details. Say what each term does. Answer "why this and not X" where a
  learner would ask it.
- **Bilingual.** Every learner-facing string is `{ en, zh }`, and the Chinese
  is written natively.
- **Narration only on scene steps.** Text pages, derivations, code and
  checkpoints get none.
- **One light theme.** Canvas labels follow the learner's language
  (`LANG_SPEC`, `ft_lang()` / `ctx.lang`).
- **Labs are tutorials** with runnable code and recommended setups (CPU is
  enough for MPC). Do not invent measured numbers.

## Audience and promise

- **Audience:** university students and engineers who know linear algebra
  (matrices, eigenvalues) and calculus. Least squares helps. No control theory
  is assumed.
- **Prerequisite links:**
  - Steve Brunton's Control Bootcamp (YouTube);
  - Boyd and Vandenberghe, Convex Optimization (free PDF, stanford.edu/~boyd/cvxbook);
  - Rawlings, Mayne and Diehl, Model Predictive Control: Theory, Computation, and Design (free PDF from the authors' site).
  - Verify every URL before using it.
- **Outcomes:**
  1. 说清 MPC 在做什么：用模型预测未来、解一个优化问题、只执行第一步、下一刻重来。
  2. 把一个带约束的控制问题写成二次规划（QP），并用代码解出来。
  3. 判断什么时候该用 MPC 而不是 PID / LQR，懂稳定性、可行性和实时性的取舍。

## Shared conventions (all lessons use exactly these)

**Notation:**
- discrete time $k$; state $x_k \in \mathbb R^n$; input $u_k \in \mathbb R^m$;
  model $x_{k+1} = A x_k + B u_k$;
- horizon $N$; stage cost $x^\top Q x + u^\top R u$; terminal cost
  $x_N^\top P x_N$;
- stacked inputs $U = (u_0,\dots,u_{N-1})$; predictions
  $X = \Phi x_0 + \Gamma U$; condensed QP $\min_U \tfrac12 U^\top H U + (F x_0)^\top U$
  subject to $G U \le w + E x_0$;
- constraints: input $u_{\min} \le u \le u_{\max}$, input rate $\Delta u$, and
  state constraints;
- feedback gain $K$; Riccati solution $P$; terminal set $\mathcal X_f$.

**Running example** (one story through the course, so the learner never
relearns a system):
- **M1–M6: a cart on a track** (double integrator).
  - State: position $p$ and velocity $v$. Input: acceleration $a$.
  - Limits: $|a| \le a_{\max}$, $|v| \le v_{\max}$, a wall at $p \le p_{\max}$.
  - Task: get to a target or follow a reference, smoothly, without breaking
    the limits.
  - $\Delta t = 0.1$ s.
- **M7: the same cart with an unknown slope or headwind** (constant
  disturbance), plus noisy position measurements.
- **M8: car path tracking** with the kinematic bicycle model (nonlinear),
  followed by a short quadrotor or robot-arm example as a pointer.

**Shared visual kit:** `packages/visuals/src/mpc/kit.ts`, built first by agent
M-A and used by everyone. It contains:
- the cart and track drawing;
- a time-plot panel (past solid, predicted dashed, constraint bands shaded);
- a horizon strip showing the plan of N steps, the first step executed, and the
  window shifting;
- a pure-TS solver: `dlqr`, prediction matrices `Φ, Γ`, and a small dense QP
  solver (active-set or projected-gradient, exact enough for n ≤ 4, N ≤ 40),
  unit-tested against closed forms.

Visuals live in `packages/visuals/src/mpc/` with their own `index.ts`. Lessons
live in `apps/mathnim/src/lessons/mpc/` with `unit.ts`. Figures go in
`apps/mathnim/public/mpc/`, labs in `docs/lessons/mpc/labs/`, and lab code in
`docs/lessons/mpc/labs/code/`.

## Lessons (about 30 minutes each; 8 lessons ≈ 4 hours)

| # | Title (zh) | Core idea | Likely interaction (only if it passes the bar) |
|---|---|---|---|
| M1 | 往前看再动手 | PID reacts to the error now. MPC plans ahead with a model and respects limits. Receding horizon: plan N steps, apply the first, replan. | Scene: the receding-horizon loop. World: the cart must stop before a wall with braking limits; compare a greedy controller with a planner, with horizon N as the cause |
| M2 | 模型：从物理到预测 | Discrete-time state space from physics (discretize the double integrator); predictions are linear in the inputs, $X=\Phi x_0+\Gamma U$ | World: drag the input bars $u_0..u_{N-1}$ and watch the predicted trajectory; derive $\Phi$ and $\Gamma$ |
| M3 | 代价：想要什么 | Quadratic cost; Q vs R is a trade-off; the unconstrained optimum is linear feedback; N→∞ gives LQR (Riccati) | World: Q and R weights, aggressive vs gentle; derivation of the unconstrained solution |
| M4 | 约束：把限制写进去 | Constraints make it a QP; level-set geometry; active constraints; why the controller becomes piecewise affine | World: a 2D QP, ellipses plus a polytope, where moving the state slides the optimum along the edges |
| M5 | 求解：每一步都要解得够快 | Condensed vs sparse; active-set, interior-point and ADMM (OSQP); warm start; the real-time budget per sample | Code page (cvxpy/OSQP); figure of solve time vs N (computed by your own script, labelled) |
| M6 | 稳定与可行：短视的代价 | A finite horizon can be unstable or infeasible; terminal cost P and terminal set; recursive feasibility; soft constraints | World: a short horizon makes the cart hit the wall or become infeasible; a terminal cost or a longer N fixes it |
| M7 | 模型不准时 | Disturbances and estimation: offset-free tracking (disturbance model, integral action), a state estimator (Kalman, brief), robust MPC (tube idea, brief) | World: an unknown slope causes steady-state offset; adding the disturbance estimate removes it |
| M8 | 非线性 MPC 与怎么选 | NMPC (shooting, SQP/RTI), the bicycle-model path-tracking case, learning and MPC (brief); choosing between PID, LQR, MPC and RL | World: car path tracking with the horizon shown; a "怎么选" decision card |

Every lesson ends with transfer checks: number, choice and text questions, with
misconception feedback. Each lesson has 1–2 worlds at most, and only where the
action is the concept. Prefer static figures and text otherwise.

**Labs** (CPU):
- L1 linear MPC for the cart with cvxpy and OSQP: constraints, tuning Q and R,
  horizon;
- L2 nonlinear MPC for car path tracking with CasADi (Ipopt);
- L3 (optional) offset-free MPC with a disturbance observer.

Each lab gives recommended setups, predict-first questions and expected
qualitative outcomes.

## Build split

| Agent | Owns | Also |
|---|---|---|
| M-A | M1, M2, M3 | builds the shared kit first and posts its API in `docs/lessons/mpc/KIT.md` |
| M-B | M4, M5, M6 | waits for KIT.md for shared drawing; can start the QP visual and math right away |
| M-C | M7, M8 and labs L1–L3 | waits for KIT.md for shared drawing |

**Ownership.** Each agent owns only its lesson files, its own visuals (one file
each in `packages/visuals/src/mpc/`) and its figures. The kit, `index.ts` and
`unit.ts` belong to M-A. Others list their visuals and lessons in their report,
and M-A or the main session adds them. Never edit `course.ts`,
`packages/visuals/src/index.ts`, `packages/core`, `packages/present` or
`manim-web`. The main session wires the course.

**Before reporting:**
- the typecheck is clean;
- the visuals check passes for your visuals, including zh examples;
- `node apps/mathnim/tools/lesson_text.mjs <id> zh` reads well once the unit is
  registered;
- you have done the product-manager pass in BUILD.md.

Send a work report in the BUILD.md format.

## Update 2026-10-26: two batches, no labs

The user decided:
- **Two batches.** Batch 1 is M1–M4 and is deployed as soon as all four pass. Batch 2 is M5–M8.
- **No labs section** for this course. The lab plan above is dropped.

Ownership now:
- **M-A:** the kit, M1, M2 and the registration of lessons and visuals.
- **M-C:** M3 first (batch 1), then M7 and M8.
- **M-B:** M4 first (batch 1), then M5 and M6.
