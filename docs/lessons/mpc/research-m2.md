# M2 "模型：从物理到预测 / The model": verified sources (as of 2026-10-26)

How things were checked: *fetched* means the page or PDF was fetched and the
quoted text read (by the M2 agent, 2026-10-26; the MathWorks quote was
re-fetched and confirmed the same day).
**(computed)** marks numbers from this repo's own code
(`packages/visuals/src/mpc/bars_math.ts`, 15 tests in `bars_math.test.ts`) or
from the lesson's Python listing, run with numpy 2.4.3 and scipy 1.17.1.
**(derivation)** marks plain algebra shown in the lesson itself.
**(simulation)** marks the toy cart: course numbers, not a real vehicle.

## 1. MathWorks, "Continuous-Discrete Conversion Methods" (Control System Toolbox docs)
- https://www.mathworks.com/help/control/ug/continuous-discrete-conversion-methods.html (fetched).
- The zero-order hold method "provides an exact match between the continuous-
  and discrete-time systems in the time domain for staircase inputs": each
  sample is held "constant over one sample period", u(t) = u[k] for
  kTs ≤ t ≤ (k+1)Ts.
- Used for: "ZOH is exact when the input really is held", `c2d` as the MATLAB
  function. Forward Euler is not presented there as exact; the lesson's Euler
  error is our own computation (below).

## 2. scipy.signal.cont2discrete
- Checked locally (scipy 1.17.1): signature `cont2discrete(system, dt,
  method='zoh', alpha=None)`, so ZOH is the default; for the double integrator
  with dt = 0.1 it returns A = [[1, 0.1], [0, 1]], B = [[0.005], [0.1]]
  **(computed)**.

## 3. Bemporad, "Model Predictive Control", course slides, part 1 (linear MPC)
- https://cse.lab.imtlucca.it/~bemporad/teaching/mpc/imt/1-linear_mpc.pdf
  (fetched; slides 36–37).
- Unrolls x_k = A^k x_0 + Σ_j A^j B u_{k−1−j} and stacks the predictions as
  X = S̄ z + T̄ x_0, with S̄ block lower triangular; then substitutes into the
  quadratic cost to get the condensed QP with H and F.
- Backs: "predictions are an affine function of the input sequence", "Γ is
  block lower triangular", and the M3/M4 pointers (condensed QP). The course
  writes Φ for T̄ and Γ for S̄ (docs/lessons/mpc/KIT.md).

## 4. Rawlings, Mayne & Diehl, *Model Predictive Control: Theory, Computation, and Design*, 2nd ed.
- https://sites.engineering.ucsb.edu/~jbraw/mpc/ (free PDFs; fetched). See
  research-c.md §0 and research-m3.md §1 for the sections read.
- General reference for the linear model x⁺ = Ax + Bu and the LQ/MPC setting.

## 5. Where real models come from, and convexity in practice (from research-c.md)
- Bemporad, Bernardini, Long & Verdejo (2018), SAE 2018-01-0875,
  https://doi.org/10.4271/2018-01-0875 (research-c.md §8d): GM's production
  engine MPC is a set of linear MPCs scheduled on operating conditions, "each
  with a model from system identification". Backs "models also come from
  measured data".
- Di Carlo et al. (2018), MIT Cheetah 3, https://doi.org/10.1109/IROS.2018.8594448
  (research-c.md §8b): the dynamics are simplified so that the problem is
  convex (a QP); solved in under 1 ms at 20–30 Hz. Backs "engineers simplify a
  model on purpose to keep the problem a QP".
- Qin & Badgwell (2003) (research-c.md §8a): NMPC applications are fewer and
  "typically much smaller", "likely due to the computational complexity of
  NMPC algorithms". Backs "why not just simulate a nonlinear model".

## 6. Our own numbers (computed / derivation / simulation)
- Exact ZOH for ṗ = v, v̇ = a: A = [[1, Δt], [0, 1]], B = [[Δt²/2], [Δt]]
  (derivation; tested against the kit's `c2d`, which uses expm).
- Γ block (k, j) = A^{k−1−j} B = [(k − j − ½)Δt², Δt] for j < k, else 0 (tested).
- World (simulation): p0 = 9.7 m, v0 = 0.5 m/s, wall 10 m, N = 10, Δt = 0.1:
  v10 = 0.5 + 0.1 Σu; p10 = 10.2 + 0.01 Σ(9.5 − j)u_j (tested).
  Early (−1 on u0..u4): at rest at 9.825 m; late (−1 on u5..u9): at rest at
  10.075 m; even (−0.5 everywhere): 9.95 m; DOCK_PLAN docks (tested).
- Stopping identity (derivation): when Σu = −v0/Δt, p_N − p_0 = v0 · t_c with
  t_c the braking-weighted mean of the mid-times (j + ½)Δt. Docking here needs
  t_c = 0.3/0.5 = 0.6 s.
- Euler (computed): from rest at 1 m/s² for 1 s, exact 0.5 m, Euler 0.45 m. The
  plan −1 on u3..u7 docks at 10.000 m under Euler's model but the exact model
  ends at 9.975 m (½Δt² Σu = 2.5 cm short) (tested).
- Python listing in the lesson: run, prints A, B, X[-2:] = [10, 0] and True.
