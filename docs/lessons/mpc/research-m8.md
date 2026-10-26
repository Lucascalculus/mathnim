# M8 sources: 非线性 MPC 与怎么选 / Nonlinear MPC, and how to choose

Lesson: `apps/mathnim/src/lessons/mpc/m8_nmpc.ts` (id `mpc-m8-nmpc`).

The sources were verified in `research-c.md` (2026-10-26). That file says how
each one was checked (fetched, Crossref, or search result). This file is an
index: each claim in the lesson, the source behind it, and the section of
research-c.md where the check is written down. Nothing here was re-fetched.
Numbers from our own simulations are listed separately at the end and are
labelled as simulations in the lesson.

## Claims → sources

| Lesson claim | Source | research-c.md |
|---|---|---|
| Kinematic bicycle equations Ẋ = v cos(ψ+β), Ẏ = v sin(ψ+β), ψ̇ = (v/l_r) sin β, β = atan(l_r/(l_f+l_r) tan δ) | Polack et al. 2018, eq. (1a–f), citing Rajamani 2012 | §6c, §6d |
| The model ignores slip and skidding | Polack et al. 2018 (quote) | §6c |
| Kinematic model used for MPC because it is cheap and works at low speed, where tyre models become singular | Kong et al. 2015 (abstract) | §6a |
| Validity: lateral acceleration below 0.5 µg | Polack et al. 2017, as stated in Polack et al. 2018 (NOT Kong 2015) | §6b |
| Ipopt finds a **local** solution, interior point, filter line search | Ipopt project page; Wächter & Biegler 2006 | §5b |
| Single shooting: inputs are the unknowns; every iterate is a physical trajectory | RMD §8.5.1–8.5.2, pp. 532–537 | §4a |
| Multiple shooting keeps the interval start states as unknowns; parallel integrations; states can be initialised from data; faster Newton-type contraction "in particular for nonlinear and unstable systems"; globalisation must also watch the continuity residuals | RMD §8.5.2 (after Bock & Plitt 1984) | §4a |
| RTI: one QP per sample, preparation (shift, linearise, build QP) before the state arrives, feedback = insert x̂, solve QP, full step | Diehl et al. 2002; Gros et al. 2020 Algorithm 3 | §4b, §4d |
| Gauss–Newton Hessian: no second derivatives, always positive semidefinite | Gros et al. 2020 | §4d |
| "Linear MPC can be regarded as an RTI scheme where the preparation phase is performed only once, off-line." | Gros et al. 2020 | §4d |
| RTI feedback time ≈ linear MPC's; often runs at linear-MPC sampling rates | Gros et al. 2020 | §4d |
| Error of the first iterate is second order in the size of the perturbation | Diehl et al. 2002 | §4b |
| Contractivity and a bound on the loss of optimality are proven | Diehl, Bock & Schlöder 2005 (abstract) | §4c |
| Feedback phase reduces the delay to unforeseen disturbances from Δt to Δt_fb; shift strategy "needs to be applied with care" | RMD §8.9.1–8.9.2 | §4e |
| CasADi: open-source, C++ with Python/MATLAB, plug-ins incl. IPOPT, C code export | Andersson et al. 2019; web.casadi.org | §5a |
| acados: C on BLASFEO, CasADi for modelling, multiple shooting, SQP-type solvers, HPIPM | Verschueren et al. 2022; docs.acados.org | §5c |
| do-mpc: Python toolbox, robust multi-stage MPC, MHE | Fiedler et al. 2023 (Control Eng. Practice) | §5d |
| Hexacopter: LMPC (CVXGEN) vs NMPC (ACADO, RTI, Gauss–Newton), both 100 Hz, 20 steps = 2 s horizon; 0.45 ms vs 2.35 ms; RMSE 7.1 vs 10.8 cm under wind | Kamel, Burri & Siegwart 2017 (arXiv 1611.09240, read) | §8c |
| Falcone 2007: MPC steering on slippery roads; full NMPC vs successive online linearisation (LTV); experiments up to 21 m/s on ice | Falcone et al. 2007 (abstract) | §6e |
| Industrial survey (mid-1999 snapshot): 4542 linear vs 93 nonlinear MPC applications; NMPC smaller "likely due to the computational complexity" | Qin & Badgwell 2003, Tables 6–7 | §8a |
| Industrial hierarchy: PID every second, MPC every minute; MPC replaces PID + lead-lag + select logic | Qin & Badgwell 2003 | §8a, decision page |
| Cheetah 3: convex MPC, horizon up to 0.5 s, under 1 ms, 20–30 Hz | Di Carlo et al. 2018 (abstract) | §8b |
| GM production engine MPC (2018): scheduled linear MPCs each with its own Kalman filter | Bemporad et al. 2018 (abstract) | §8d |
| Learning + MPC, three categories (learn the model, learn the parameterisation, MPC as safety layer for learned controllers) | Hewing et al. 2020 (abstract) | §7a |
| LMPC: safe set and terminal cost from stored laps; recursive feasibility; non-increasing cost | Rosolia & Borrelli 2018 | §7b |
| Neural networks can represent/approximate the piecewise-affine linear MPC law; cheap online evaluation | Chen et al. 2018; Karg & Lucia 2020 | §7c |
| Double integrator: nominal model-based control near-optimal from 10 samples; policy gradient needs "thousands of times as many samples"; "fail to be safe" | Recht 2019 (arXiv v2) | §7d |
| Saturated LQR + anti-windup can deteriorate badly vs MPC under severe constraints (second-hand) | Qin & Badgwell citing Goodwin et al. 2001 | decision page |
| Decision-card wording | **(inference)**, synthesised in research-c.md from the rows above | decision page |

## Contested or soft points (marked as such in the lesson)

- "When to use RL instead of MPC" has no settled answer; the lesson gives the
  sourced facts (data hunger and safety in Recht 2019; MPC as safety layer in
  Hewing 2020) and calls the rest a judgement.
- Kamel 2017's "NMPC faster than LMPC" comes from RTI + code generation on
  their setup; the lesson says it is not a general rule.
- Ipopt iterations quoted on the code page are from our run (below), not from
  a benchmark.

## Our simulations (labelled "simulation" / "模拟" in the lesson)

All in TypeScript, `packages/visuals/src/mpc/car_math.ts`, tested in
`car_math.test.ts` (15 tests). Toy car: l_f = l_r = 1.4 m, |δ| up to 0.5 rad,
a in [−4, 2] m/s², 6 m/s, Δt = 0.1 s, N = 20, RK4. The plant is the
controller's own model. The S road: straight 12 m, left R 9 m 90°, straight 4 m,
right R 9 m 90°, straight 30 m.

- Bends ask v²/R = 36/9 = 4 m/s² ≈ 0.41 g, under 0.5 µg for µ = 1 (inference:
  dry road µ ≈ 1 assumed).
- Closed loop, largest lateral error |e| (the 15 cm "brief" is a toy number we
  chose; the lane is ±1.5 m and no setting leaves it):
  - warm (last plan shifted), 1 QP per sample (RTI): 9.2 cm; converged: 9.2 cm
    at 2.8 QPs per sample on average;
  - cold (straight ahead), 1 QP: 32.6 cm (cuts both corners, +32.6 / −30.6 cm),
    slows to 5.1 m/s; 2 QPs: 12.2 cm; 3 QPs: 9.4 cm; converged: 9.2 cm at 4.9
    QPs per sample;
  - QP prediction vs the plan's true motion at the end of the horizon: warm
    below 5 mm; cold-1 up to 3.2 m.
  - N = 5 hides the cold-start problem (7.6 cm with one cold QP).
- Shooting picture (one 2.5 s horizon entering the first bend, from scratch):
  single shooting cost 113.9 → 8.39 → 1.55 → 1.52; multiple shooting largest
  gap 1.24 m → 2.6 mm → 0.01 mm; after one iteration the multiple-shooting
  inputs already cost 1.54; both end at the same plan (inputs equal to 1e-5).
  The node states start from a fixed irregular offset of up to about 0.8 m
  from the road (made up, standing in for "initialised from data").

## The CasADi code page (run offline, never in the website)

`docs/lessons/mpc/m8/nmpc_casadi.py`, run on 2026-10-26 with
`docs/lessons/mpc/labs/code/.venv` (Python 3.12.12, CasADi 3.8.1 with its
bundled Ipopt, NumPy 2.5.4). The page shows the file as text only. Output:

```
largest |e| = 9.3 cm, Ipopt iterations per sample: 5 to 5
```

Same car, road, cost and bounds as the TypeScript world, multiple shooting,
warm-started with the shifted solution. The 9.3 cm agrees with the TS
converged result (9.2 cm); the 1 mm difference comes from the Python road
lookup (nearest 5 cm sample, no interpolation). With a cold start each sample
(straight ahead) the same script gave the same 9.3 cm with 5 to 8 Ipopt
iterations (a one-line change, not shown on the page).

## Figures

- `apps/mathnim/public/mpc/m8/rti-timeline.{en,zh}.svg`: own schematic after
  Diehl et al. 2002 and Gros et al. 2020 Algorithm 3; generated by
  `docs/lessons/mpc/m8/figures.py`.
