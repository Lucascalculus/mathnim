# M4 "约束：把限制写进去 / Constraints": verified sources (as of 2026-10-26)

How things were checked: *read* means I opened the PDF and read the cited
pages myself (page images). **(computed)** marks numbers from this repo's code
(`packages/visuals/src/mpc/qp2d.ts`, unit-tested in `qp2d.test.ts` and
`explicit_map.test.ts`) or from `docs/lessons/mpc/m4/m4_qp.py` (run with
python3 + cvxpy 1.8.2). **(inference)** marks my own reasoning.

## 1. Bemporad, Morari, Dua & Pistikopoulos (2002), "The explicit linear quadratic regulator for constrained systems", *Automatica* 38(1):3–20

- DOI 10.1016/S0005-1098(01)00174-1 (Crossref metadata checked: title, four
  authors, vol. 38, issue 1, pp. 3–20, January 2002).
- Author's PDF, read pp. 3–8:
  https://cse.lab.imtlucca.it/~bemporad/publications/papers/automatica-mpqp.pdf
- Abstract (p. 3): the state-feedback law that minimises a quadratic cost
  under input and state constraints is "piece-wise linear and continuous" for
  the finite-horizon (MPC) problem; "the on-line control computation reduces
  to the simple evaluation of an explicitly defined piecewise linear function."
  → lesson pages `explicit`, check (d).
- §2.1, eq. (7), p. 6: the MPC problem written as
  min ½UᵀHU + xᵀFU s.t. GU ≤ W + Ex(t), H ≻ 0 — the same form as the course's
  `G U ≤ w + E x0`. "The optimization problem (7) is a quadratic program." →
  derive `qp`.
- p. 6: on-line QP "demands significant on-line computation effort", which
  limited MPC to "slow" and/or "small" processes; the paper moves the
  computation off-line by treating x(t) as a parameter (multi-parametric QP).
- Theorem 2, p. 8: for a fixed combination of active constraints with linearly
  independent rows, z and λ are affine functions of x over the critical region
  CR₀; eqs. (19)–(20) show CR₀ is a polyhedron (primal feasibility and λ ≥ 0).
  KKT (15a–d) are stated there. → `explicit`, `kkt`.
- p. 6: "the solution U*(x) of the mp-QP problem is a continuous and piecewise
  affine function of x", inherited by the controller u = [I 0 … 0]U*.

## 2. Alessio & Bemporad (2009), "A Survey on Explicit Model Predictive Control", in Magni et al. (eds.), *Nonlinear Model Predictive Control*, LNCIS 384, pp. 345–369, Springer

- DOI 10.1007/978-3-642-01094-1_29 (Crossref checked: title, pp. 345–369).
- Author's PDF, read pp. 345–364:
  https://cse.lab.imtlucca.it/~bemporad/publications/papers/nmpc08-survey-explicit.pdf
- Abstract (p. 345): on-line operations "reduce to a simple function
  evaluation"; the function is "piecewise affine in most cases, so that the
  MPC controller maps into a lookup table of linear gains."
- Theorem 1, p. 353 (citing Bemporad et al. 2002): with H ≻ 0 the feasible
  set is polyhedral, the value function is continuous, convex and piecewise
  quadratic, the optimizer is piecewise affine and continuous.
- p. 354: the number of critical regions is upper-bounded by 2^q, q = the
  number of constraints ("usually very conservative").
- p. 360: complexity is reduced by shortening the horizon "(and/or blocking
  input moves)"; "In practice, explicit MPC is limited to relatively small
  problems (typically one/two inputs, up to five-ten states, up to three/four
  free control moves)". → `explicit` (only for small problems), and the
  two-move blocking in `two-moves` is a recognised technique, not a trick.
- p. 362: the double integrator with N = 8, Ts = 0.1 has an exact explicit
  solution of M = 99 regions. (Not used in the lesson; it supports "the count
  grows quickly".)
- p. 363: on-line, the right gain is chosen by finding the region the state
  lies in, the "point-location problem".
- p. 364 (Conclusions): the number of regions "grows massively with the size
  of the problem (mainly with the number of constraints)". Applications: 1–2
  inputs, 5–10 parameters, sampling 1–50 ms (§6).
- Tools (§5): Hybrid Toolbox, Multi-Parametric Toolbox (MPT). MPT3 site
  https://www.mpt3.org/ (HTTP 200 checked).

## 3. Boyd & Vandenberghe, *Convex Optimization* (2004), free PDF

- https://web.stanford.edu/~boyd/cvxbook/ (HTTP 200), PDF bv_cvxbook.pdf; read
  book pp. 243–244 and 249–250.
- §5.5.2–5.5.3, pp. 242–244: complementary slackness λᵢ* fᵢ(x*) = 0 ("the
  ith optimal Lagrange multiplier is zero unless the ith constraint is active
  at the optimum"); the KKT conditions (5.49); for convex problems KKT are
  sufficient; Example 5.1, the equality-constrained QP solved by one linear
  system [P Aᵀ; A 0][x; ν] = [−q; b]. → `kkt`, `explicit` (fixed active set
  ⇒ linear system).
- §5.6, pp. 249–251: perturbing constraint i to fᵢ ≤ uᵢ; p*(u) is convex for a
  convex problem; global inequality (5.57); local sensitivity λᵢ* = −∂p*/∂uᵢ
  (§5.6.3). → λ as "how much J* drops per unit of relaxing the limit", check (a).
- Convex QP with H ≻ 0 has a unique minimiser (strict convexity; standard,
  §4.4 QP). → derive `qp`.

## 4. Course numbers (computed)

Two-move QP (`qp2d.ts`): a₁ for 0–1 s, a₂ for 1–2 s, N = 20, Δt = 0.1,
flag p_ref = 9.5, r = 0.1, Q = P = diag(1, 0); limits |a| ≤ 1, |v| ≤ 2, p ≤ 10
checked at 1 s and 2 s. H = [[26.97, 4.95], [4.95, 3.27]].

| x0 (p, v) | no-limits | clipped | best | active (λ) | J_best / J_clip |
|---|---|---|---|---|---|
| (8, 0) | 1.465, −0.453 | 1, −0.453 | 1, 0.253 | a₁ ≤ 1 (9.06) | 23.35 / 24.17 |
| (7, 0) | 2.442, −0.754 | 1, −0.754 | 1, 1 | a₁ ≤ 1, a₂ ≤ 1 | 79.57 / 87.06 |
| (6, 1.5) | 1.353, −1.083 | 1, −1 (v(1 s) = 2.5: illegal) | 0.5, 0 | v(1 s), v(2 s) ≤ 2 | 89.13 / 83.52 |
| (7.1, 1.9) | −0.272, −0.758 | same (breaks p(2 s) ≤ 10) | −0.313, −0.861 | p(2 s) (1.08) | 30.15 / 30.09 |
| (9, 0.2) | 0.213, −0.154 | same | same | none | 1.71 |
| (9.3, 1.8) | — | — | no plan | — | — |

Sensitivity at (8, 0): raising the a₁ limit by 0.01 lowers J* by 0.0896
(λ·0.01 = 0.0906); by 0.1, by 0.81 (tested). The explicit map over p 4–10,
v 0–2 has 12 regions (tested).

Full N = 20 QP (`m4_qp.py`, cvxpy): from (7, 0) the free first input is
6.75 m/s²; clipped u0, u9, u19 = 1, −0.85, −0.03; best = 1, 1, 0.03;
J_clip = 103.95, J_best = 79.32; the active rows are u_k ≤ 1 for k = 0…14.
From (7.1, 1.9) the clipped plan reaches 10.10 m (past the wall) and
2.12 m/s.

## 5. Inference (mine)

- Clipping each move to the limit is what a saturating actuator does; it is
  the optimum only when the decision is a single scalar with bounds (a 1-D
  convex quadratic minimised over an interval is the clipped free minimiser).
  With two or more coupled moves (H not diagonal: H₁₂ = 4.95) the remaining
  moves must be re-optimised.
- At (7, 0) the best plan ends near the flag at about 1.7–2 m/s because the
  terminal cost has no speed term; a short-horizon effect taken up in M6.
