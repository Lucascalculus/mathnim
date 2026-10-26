# M1 "往前看再动手 / Look ahead, then act": sources (as of 2026-10-26)

How things were checked: *fetched* means the page or PDF was fetched and the
quoted text read. **(simulation)** marks numbers from this repo's own toy
model (`packages/visuals/src/mpc/dock.ts` on top of the kit's `make_mpc`,
unit-tested in `dock.test.ts`); they describe the course's toy cart, not a
real vehicle, and every canvas that shows them says "simulation / 模拟".
**(standard)** marks textbook physics or control facts not tied to one page.
**(inference)** marks our own reasoning.

## 1. What MPC is (the one-sentence definition and the receding horizon)

Rawlings, Mayne & Diehl (RMD), *Model Predictive Control: Theory,
Computation, and Design*, 2nd ed., 6th printing PDF:
https://sites.engineering.ucsb.edu/~jbraw/mpc/MPC-book-2nd-edition-6th-printing.pdf
(fetched 2026-10-26, text extracted with pdftotext and read; see also
research-c.md §0).
- §1.2, p. 1: "The basic concept of MPC is to use a dynamic model to forecast
  system behavior, and optimize the forecast to produce the best decision—the
  control move at the current time." Backs the `idea` page's sentence.
- §1.3.1, p. 11: "The constraints are the main feature that distinguishes MPC
  from the standard linear quadratic (LQ) control." Backs "three ingredients"
  and the pointer to M4.
- §2.2, p. 99: "In MPC, the control applied to the plant is the first element
  … of the optimal control sequence. At the next sampling instant, the
  procedure is repeated for the successor state." Backs "apply the first,
  measure, repeat" (the `loop` scene and the `first-predict` question).
- Same page: MPC "does not require determination of the control law κN(·), a
  task that is usually intractable when constraints … are present"; it solves
  the problem only at the state it is in. Used for "it solves one problem at
  the state it actually measured".

## 2. PID reacts to the error (standard)

- A PID controller sets the input from the current error, its integral and
  its derivative, u = k_p e + k_i ∫e + k_d de/dt **(standard)**. It has no
  model of the plant and no place for limits in its design; in industry,
  limits are handled by add-ons: Qin & Badgwell (2003, §2, below) describe
  conventional constraint control as "a combination of PID algorithms,
  lead-lag (L/L) blocks and high/low select logic", which MPC replaces with a
  single controller (research-c.md §8a, fetched).
- The lesson's PD law a = k_p(10 − p) − k_d v, clipped to |a| ≤ a_max, is the
  PID family without the integral term **(standard)**; the integral term is
  left out because the task has no steady disturbance (that is M7).

## 3. The docking story (all simulation)

Toy cart (the course's running example): double integrator, Δt = 0.1 s,
exact zero-order hold A = [[1, 0.1], [0, 1]], B = [[0.005], [0.1]]; start at
rest at p = 0, wall at p = 10 m, |v| up to 2 m/s, |a| up to a_max. MPC cost
Σ_{k=0}^{N} (p_k − 10)² + 0.1 Σ_{k=0}^{N−1} a_k², hard constraints on a, v
and p ≤ 10 for k = 1..N; when no plan exists (QP infeasible) it brakes fully.
Runs end when the cart hits the wall or rests against it. **(simulation)**,
all in `dock.test.ts` or computed with `dock.ts` on 2026-10-26:
- PD with brakes 1 m/s²: (k_p, k_d) = (1, 1) hits at 1.17 m/s; (0.5, 1.4) is
  still 15 cm short at 10 s; (2.5, 3.05) docks at t = 8.6 s. The same tuned PD
  with brakes 0.5 m/s² hits at 1.33 m/s.
- MPC with brakes 1: N = 2 hits at 1.90 m/s, N = 5 at 1.55, N = 10 at 1.00,
  N = 15 at 0.54, N = 18 at 0.14 m/s. **N = 19 is the shortest that docks**
  (t = 7.3 s); N = 20 docks at 7.3 s; N = 30 and N = 45 dock at 7.1 s.
- MPC with brakes 0.5: N = 19 hits at 1.10 m/s, N = 30 at 0.52, N = 39 at
  0.05; **N = 40 is the shortest that docks** (t = 9.0 s). With a_max = 0.8,
  the shortest is 25.
- The plan made at t = 5.0 s (p = 8, v = 2, the last moment a full stop still
  fits): N = 10 says "no braking" and ends at the wall at 2.00 m/s; N = 15
  brakes 0.27 m/s²; N = 18 brakes 0.95; N = 19 and 20 brake fully. Every one
  of these plans satisfies all its constraints inside its own window.
- Push of +0.3 m/s at t = 1 s: the t = 0 plan (N = 20) executed blindly hits
  the wall at 1.92 m/s; re-planning every 0.1 s from the measured state docks
  at t = 7.0 s.

## 4. Why 19 steps and not 20 (computed by hand, checked against the simulation)

- Stopping from v at constant deceleration a takes v/a seconds and v²/(2a)
  metres **(standard)**: 2 s and 2 m for v = 2, a = 1; 4 s and 4 m for a = 0.5.
- In discrete time with zero-order hold, braking at 1 m/s² from 2 m/s takes
  20 steps; the distance is Σ_{j=0}^{19} (v_j Δt − a Δt²/2) with
  v_j = 2 − 0.1 j, which is 2.100 − 0.100 = 2.000 m. After 19 steps the cart
  has covered 1.995 m and still moves at 0.1 m/s: the 20th step covers only
  5 mm **(computed)**.
- A 19-step plan made at p = 8, v = 2 therefore already sees that any delay in
  braking crosses the wall inside its window (one step of coasting adds
  0.2 m, more than the 5 mm of slack), so its first step is full braking; the
  last 5 mm are handled by the next re-plans **(inference, consistent with the
  simulation: N = 19's plan ends at the wall at 0.19 m/s and the run docks)**.
  An 18-step window can still stay off the wall while braking only 0.95, and
  that shortfall is what hits at 0.14 m/s **(simulation)**.
- Likewise for a_max = 0.5: 40 steps = 4.0 s **(simulation)**, the step grid
  at that deceleration not shaving off a whole step.

## 5. Where MPC runs (preview page), all from research-c.md, fetched there

- Qin, S. J., & Badgwell, T. A. (2003). A survey of industrial model
  predictive control technology. *Control Engineering Practice*, 11(7),
  733–764. https://doi.org/10.1016/S0967-0661(02)00186-7 (research-c.md §8a):
  over 4600 applications in a mid-1999 vendor survey, refining 67% of the
  classified ones; Fig. 2 hierarchy: basic (PID) control "every second", MPC
  "every minute"; refinery controllers "run on the order of once each
  minute". The lesson says only that MPC runs in refining and
  petrochemicals, about once a minute, on top of PID loops that run every
  second; the history is not told (§6).
- Di Carlo, J., Wensing, P. M., Katz, B., Bledt, G., & Kim, S. (2018).
  Dynamic Locomotion in the MIT Cheetah 3 Through Convex Model-Predictive
  Control. IROS. https://doi.org/10.1109/IROS.2018.8594448 (research-c.md
  §8b): horizons up to 0.5 s, solved in under 1 ms, at 20–30 Hz.
- Kamel, M., Burri, M., & Siegwart, R. (2017). Linear vs Nonlinear MPC for
  Trajectory Tracking Applied to Rotary Wing Micro Aerial Vehicles.
  IFAC-PapersOnLine 50(1). https://arxiv.org/abs/1611.09240 (research-c.md
  §8c): both controllers run at 100 Hz and predict 20 steps = 2 s ahead.
  Used in `takeaway` as a real look-ahead next to the toy's.
- Bemporad, A., Bernardini, D., Long, R., & Verdejo, J. (2018). Model
  Predictive Control of Turbocharged Gasoline Engines for Mass Production.
  SAE 2018-01-0875. https://doi.org/10.4271/2018-01-0875 (research-c.md
  §8d): engine torque MPC "scheduled for production by General Motors
  starting in calendar year 2018".

## 6. Deliberately left out

- The history of MPC (IDCOM, DMC, Richalet, Cutler & Ramaker): not verified
  this session (WebFetch failures), so not mentioned.
- Any claim that MPC beats PID in general: the lesson says the opposite where
  limits do not bind (the `mpc-always-better` check), backed by Q&B's
  hierarchy (PID stays at the base layer).
