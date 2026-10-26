# M5 research: 求解：每一步都要解得够快 / Solving: fast enough, every step

Lesson `mpc-m5-solving` (`apps/mathnim/src/lessons/mpc/m5_solving.ts`). Every
factual claim in the lesson is listed here with its source. Course numbers
(the toy cart) are marked as such; measured numbers come only from
`docs/lessons/mpc/m5/bench.json`.

## 1. Sources (checked 2026-10-26: DOIs resolve, pages load)

| Key | Source | What we use |
|---|---|---|
| osqp | Stellato, Banjac, Goulart, Bemporad, Boyd (2020). OSQP: an operator splitting solver for quadratic programs. *Math. Prog. Comp.* 12:637–672. doi:10.1007/s12532-020-00179-2; arXiv:1711.08013 | ADMM iteration (Alg. 1); the KKT matrix of its linear system does not change with ρ fixed, so it is factored once and each iteration is "division-free" (forward/back substitution); warm starting; infeasibility detection; ADMM reaches modest accuracy quickly, high accuracy slowly; active-set methods' worst-case iteration count is exponential (Klee–Minty), interior-point methods are hard to warm start. |
| osqp-settings | OSQP solver settings page, https://osqp.org/docs/interfaces/solver_settings.html (read 2026-10-26) | defaults: `eps_abs = eps_rel = 1e-3`, `max_iter = 4000`, `rho = 0.1`, `sigma = 1e-6`, `alpha = 1.6`, `polishing = False`, `warm_starting = True`, `check_termination = 25`, `adaptive_rho_interval = 0` (automatic, by a fraction of setup time), `time_limit` (seconds; default 1e10 = none). |
| banjac | Banjac, Stellato, Moehle, Goulart, Bemporad, Boyd (2017). Embedded code generation using the OSQP solver. CDC 2017. doi:10.1109/CDC.2017.8263928 | OSQP generates library-free C for embedded MPC. |
| qpoases | Ferreau, Kirches, Potschka, Bock, Diehl (2014). qpOASES: a parametric active-set algorithm for quadratic programming. *Math. Prog. Comp.* 6(4):327–363. doi:10.1007/s12532-014-0071-1 | online active set / homotopy from the previous QP; warm/hot start definitions (p. 5); suited to small–medium dense QPs, up to roughly 1000 unknowns (§2.3.6, §4.3). |
| ferreau08 | Ferreau, Bock, Diehl (2008). An online active set strategy to overcome the limitations of explicit MPC. *Int. J. Robust Nonlinear Control* 18(8):816–830. doi:10.1002/rnc.1251 | consecutive MPC QPs differ little; the previous active set is a good start. |
| clarabel | Goulart, Chen (2024). Clarabel: an interior-point solver for conic programs with quadratic objectives. arXiv:2405.12762 | the interior-point solver used in the measurement. |
| wangboyd | Wang, Boyd (2010). Fast model predictive control using online optimization. *IEEE TCST* 18(2):267–278. doi:10.1109/TCST.2009.2017934 | exploiting the stage structure: cost per Newton step about T(n+m)³ with the structure, instead of about T³m³ for the condensed (dense) problem (§III); warm start from the previous plan shifted one step (§III-D); a fixed barrier parameter and a limited number of Newton steps (early termination) still give good control (§IV); worked examples solve in a few ms. |
| kouzoupis | Kouzoupis, Frison, Zanelli, Diehl (2018). Recent advances in quadratic programming algorithms for nonlinear model predictive control. *Vietnam J. Math.* 46:863–882. doi:10.1007/s10013-018-0311-1 | condensing: cost of building and factoring the dense QP grows with N³ (dense linear algebra); sparse (structure-exploiting) solvers grow linearly in N and cubically in the stage size; condensing pays off for short horizons / many states compared with inputs (§3.1–3.2). |
| bv | Boyd, Vandenberghe (2004). *Convex Optimization*, §11.3.2 pp. 575–576. https://web.stanford.edu/~boyd/cvxbook/ | the number of Newton steps of an interior-point method grows very slowly with problem size (roughly 20–30 over a 100× range in their example). |
| cvxpy-dpp | CVXPY docs, Disciplined Parametrized Programming, https://www.cvxpy.org/tutorial/dpp/index.html | a DPP problem with `Parameter`s is compiled once; re-solves with new parameter values skip the compilation. |
| cvxpy-solvers | CVXPY docs, Solver features / options, https://www.cvxpy.org/tutorial/solvers/index.html | `warm_start=True` option; OSQP options passed through (cvxpy's own OSQP defaults: `max_iter` 10,000, `eps_abs` 1e-5). |

## 2. Measured numbers (`docs/lessons/mpc/m5/bench.py` → `bench.json`)

Machine: Apple M4, 10 cores, 24 GB, macOS 26.5.2, Python 3.12.12, numpy 2.4.3,
scipy 1.17.1, OSQP 1.1.1, Clarabel 0.11.1; 2026-10-26. Task: the course cart
docking from rest at p = 0 against the wall at 10 m (target p = 10), Q =
diag(1, 0), R = 0.1, P = Q, |a| ≤ 1, |v| ≤ 2, p ≤ 10, 90 samples of closed
loop on the exact model; 5 repeats; times = wall clock around `solve()`
(Python overhead included); statistics over samples 1–89 (sample 0 is always
cold). OSQP at its default accuracy 1e-3, polishing off, `adaptive_rho_interval
= 25` (fixed, for repeatability), `check_termination = 1`.

| N | IP sparse median / max | IP condensed median / max | OSQP sparse cold median / max (iters median) | OSQP sparse warm (shifted) median / max (iters) |
|---|---|---|---|---|
| 20 | 190 µs / 295 µs | 365 µs / 475 µs | 482 µs / 1.44 ms (202) | 39 µs / 202 µs (12) |
| 40 | 609 µs / 872 µs | 2.29 ms / 3.43 ms | 1.16 ms / 6.10 ms (159) | 81 µs / 840 µs (6) |
| 80 | 1.03 ms / 1.42 ms | 15.1 ms / 21.4 ms | 2.53 ms / 7.60 ms (248) | 68 µs / 133 µs (6) |
| 160 | 2.28 ms / 2.68 ms | 229 ms / 258 ms | 6.78 ms / 19.0 ms (249) | 224 µs / 397 µs (6) |
| 320 | 3.88 ms / 4.90 ms | not run | 10.2 ms / 28.5 ms (245) | 249 µs / 513 µs (6) |

- Interior-point iterations: 10–19 at every N (sparse 10–12 median; condensed 14–19).
- Condensed IP passes the 100 ms sample between N = 80 and N = 120 (151.8 ms median at N = 120).
- Iterations over one run (N = 20): OSQP cold 18,986 total, warm (shifted) 1,405,
  warm (previous solution, unshifted) 4,814; Clarabel 865 (8–14 per sample).
- Sizes at N = 20: sparse 60 variables, 100 rows; condensed 20 variables, 60 rows.

Early termination (OSQP limited to k iterations per sample, N = 20; fallback
"iterate" = apply what the solver has; "shifted" = previous converged plan):

| k | cold: converged / closest to wall / max speed | warm (shifted): converged / closest / max speed |
|---|---|---|
| 5 | 0 / 39.7 m (goes through the wall) / 8.9 m/s | 0 / 35.0 m / 8.4 m/s |
| 10 | 0 / 3.94 m (never gets there) | 42 / 10.005 m / 2.017 m/s (iterate) |
| 20 | 0 / 9.985 m, max speed 2.24 m/s | 63 / 10.002 m / 2.006 m/s |
| 40 | 10 / 10.009 m / 2.09 m/s | 85 / 10.002 m / 2.006 m/s |

With the "shifted plan" fallback used for many samples in a row (k = 10, 20),
the cart ends up at 12.0 m and 10.86 m: an old plan replayed open loop. The
fallback is for an occasional miss, not a way of life.

Tolerance: at OSQP's default 1e-3 the converged runs pass the wall by 2–5 mm
(max p 10.0018–10.0053) and the speed limit by up to 6 mm/s: the relative
tolerance scales with the size of the numbers (p ≈ 10 m).

## 3. The code page (`docs/lessons/mpc/m5/m5_loop.py`, run with the venv in `labs/code/.venv`: cvxpy 1.9.3, OSQP 1.1.3)

Verified offline (2026-10-26):
- With `eps = 1e-3` and the 1 mm back-off: closest 10.0015 m (crosses).
  With no back-off: 10.0030 m. With `eps = 1e-4` and no back-off: 10.0006 m.
- With `eps = 1e-4` and the 1 mm back-off (the page's setting): three runs end
  at p = 9.9989–9.9994 m, v ≈ 0.001 m/s; closest to the wall 9.9995–9.9998 m;
  0 fallbacks; worst solve after the first 26–27 ms (cvxpy overhead included;
  `time_limit = 0.02` caps OSQP itself). An earlier run of the same script
  (before excluding sample 0's compile time) had 2 fallbacks: whether the
  time limit bites depends on the machine and the moment.
- Speeds pass 2 m/s by about 1.4 mm/s at 1e-4 (not backed off in the code).

The website never runs Python: the page shows this code as text; the figures
come from bench.json (offline); the visuals use the TypeScript kit and
`solvers2d.ts`.

## 4. The toy pictures (exact, TypeScript; `packages/visuals/src/mpc/solvers2d.ts`, tests in `solvers2d.test.ts`)

Two-move cart QP of M4 (`qp2d.ts`): a₁ for 0–1 s, a₂ for 1–2 s, flag 9.5 m.
- At (7 m, 0): no-limits plan (2.44, −0.75); active set adds a1+ then a2+
  (2 changes) to (1, 1); interior point 10 Newton steps (tol 1e-6) from the
  polygon's centroid; ADMM (fixed ρ = 3, no scaling) 25 steps to 1e-3.
  With OSQP's ρ = 0.1 unscaled it needs several times more (tested).
- Closed loop of the two-move MPC from (4 m, 0) (`loop_states`): optimal
  working set {v(1 s) ≤ 2, v(2 s) ≤ 2} at samples 11–21; at 22 the kept set's
  λ for v(2 s) is −0.57 (drop it: {v(1 s)}); at 23 the wall row p(2 s) ≤ 10
  is broken (add it: {v(1 s), p(2 s)}). From sample 18, warm start: 2 changes
  over samples 19–23; from scratch: 9 (2, 2, 2, 1, 2).
