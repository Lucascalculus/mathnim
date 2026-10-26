# M7 "模型不准时 / When the model is wrong": sources, claim by claim (as of 2026-10-26)

All sources were verified in `research-c.md` (§0–3, §8a); this file maps every
factual claim of `apps/mathnim/src/lessons/mpc/m7_disturbances.ts` to them. How
they were checked (fetched PDF, Crossref, abstract via OpenAlex, search result)
is stated there, entry by entry.

**(computed)** marks numbers from this repo's own code:
`packages/visuals/src/mpc/disturbance.ts`, unit-tested in `disturbance.test.ts`
(15 tests) and `m7_views.test.ts` (2 tests), or from the lesson's Python listing,
run with cvxpy 1.8.2, numpy 2.4.3, scipy 1.17.1 (output: `nominal: offset -10.8 cm`,
`offset-free: offset 0.0 cm, d_hat = -0.300`). **(inference)** marks our own
reasoning. Every canvas is labelled as a simulation of a toy cart; no number in
the lesson is a measurement of a real system.

## 1. Offset and offset-free MPC

| Claim in the lesson | Source |
|---|---|
| A steady unknown push leaves the nominal MPC at rest at e = d / K_p; with q = 1, K_p = 2.79 and e = −10.8 cm; with q = 10, K_p = 8.0 and e = −3.75 cm; the plan at t = 10 s still expects to reach the flag | (computed) `offset_run`, tests "rests at d / K_p", "shrinks with a larger q", "plans to get back" |
| Near rest the MPC equals the LQR law u = u_s − K(x − x_s) | (computed) test "equals the LQR law"; the LQR link is M3 (research-m3.md, RMD §1.3) |
| A 1.75° slope pulls as hard as 0.3 m/s² | (inference) 9.81 · sin 1.75° = 0.30 |
| Any purely proportional controller has the same offset; re-planning with the same model does not remove it | (inference) from the derivation e = d / K_p; RMD §1.5.2 p. 49 motivates the disturbance model this way |
| With a hand-set d̂ the offset is (d − d̂)/K_p; d̂ = d removes it | (computed) test "with a hand-set d̂" |
| Augmented model x⁺ = Ax + B(u + d), d⁺ = d; "we are free to choose B_d and C_d" subject to detectability | RMD §1.5.2 eq. (1.43) and text (research-c.md §1c) |
| Estimate update d̂⁺ = d̂ + λ·(prediction error)/Δt, error shrinks by (1 − λ) per step; d̂ is a running sum of prediction errors (integral action) | (computed) test "shrinks the estimate's error by (1 − λ)"; the simple update is our illustration of the estimator (RMD uses a Kalman filter on the augmented model, §1c) |
| Steady target [[I − A, −B], [C, 0]] [x_s; u_s] = [B d̂; r], giving u_s = −d̂ | RMD §1.5.2 eq. (1.45) with B_d = B, C_d = 0, H = I (research-c.md §1c); (computed) test "shifts the target" |
| Offset-free MPC rests on the flag for every wind and every q | (computed) test "rests on the flag for every wind and every weight" |
| The zero-offset argument does not use what generates the plant output | RMD p. 53, Lemma 1.10 and the remark after it (research-c.md §1c) |
| Zero offset needs the limits inactive at rest; PID integral action has the same either-or | RMD Lemma 1.10 hypotheses and p. 49 (research-c.md §1c) |
| Rank test rank [[I − A, −B_d], [C, C_d]] = n + n_d | RMD Lemma 1.8 (research-c.md §1c) |
| Cart, position only: B_d = B gives det Δt² (rank 3); output bias gives rank 2 | research-c.md §1c (inference there); (computed) test "passes the detectability test" |
| Why the bias fails: a cart can rest anywhere, so a sensor bias and a shifted rest look identical | (inference) [p, 0, d] and [p + c, 0, d − c] are both steady states with the same output |
| Industry's bias update (constant output disturbance) gives integral action for stable plants but fails for integrating plants | Qin & Badgwell (2003) §3.4.1 (research-c.md §1a and §8a, full text read) |
| Put the disturbance where it enters; n_d = p disturbances suffice | Pannocchia & Rawlings (2003) abstract; Muske & Badgwell (2002); RMD Corollary 1.9 and p. 53 (research-c.md §1a–1c) |

## 2. Kalman filter

| Claim | Source |
|---|---|
| Differencing two measurements with 5 cm noise at Δt = 0.1 s gives about 0.7 m/s of error | (inference) 5√2 cm / 0.1 s; the scene's realised value 0.80 m/s is (computed) `kalman_numbers()` |
| Filter speed error about 0.12 m/s; position gain settles at L_p ≈ 0.29; the filter beats raw measurement in position | (computed) `kalman_run`, tests in `disturbance.test.ts` and `m7_views.test.ts` |
| Predict/correct equations, gain L = P⁻Cᵀ(CP⁻Cᵀ + V)⁻¹, P = (I − LC)P⁻ | Welch & Bishop TR 95-041 (research-c.md §2b), with their Q, R, H, z renamed W, V, C, y |
| V is usually measured from sensor data; W is harder and often tuned | Welch & Bishop (research-c.md §2b) |
| Filtering is the dual of the (noise-free) regulator problem | Kalman (1960) abstract (research-c.md §2a); "a Riccati equation of the same form" is (inference) |
| A Kalman filter on the augmented model supplies x̂ and d̂ in offset-free MPC | RMD §1.5.2 "Estimation" (research-c.md §1c) |
| Larger V gives a smaller gain (smoother, slower) | the formula L_p = P⁻/(P⁻ + V); (computed) test "is best with the true noise ratio" |
| The scene's filter starts from the known start state | stated in `disturbance.ts` (an honest simplification) |

## 3. Tube MPC

| Claim | Source |
|---|---|
| Explicitly robust MPC multiplies constraints by the number of disturbance sequences, which can exceed 10⁶ in process control | RMD §3.5 (research-c.md §3c) |
| Tube idea: nominal plan with tightened constraints, plus feedback u = ū + K(x − x̄); online cost similar to nominal MPC | RMD §3.5.1–3.5.3; origin Langson et al. (2004), Mayne, Seron & Raković (2005) (research-c.md §3a–3c) |
| Error dynamics e⁺ = A_K e + w; without feedback the error grows without bound | RMD §3.5 (book example S(i) = (i + 1)W) (research-c.md §3c) |
| S = Σ A_K^j W is the (minimal) disturbance-invariant set; X̄ = X ⊖ S, Ū = U ⊖ KS | RMD §3.5.2–3.5.3 (research-c.md §3c) |
| Real state converges to the tube around the target, not the target | RMD Proposition 3.12 (research-c.md §3c) |
| Tube widths 0.18 m / 0.15 m/s / 0.22 m/s² at w̄ = 0.15; open loop 4 of 12 cross, feedback 8 of 12, tightened 0; the error stays inside the widths | (computed) `tube_widths`, `tube_panels`, tests "the tube" and "M7 scene numbers" (12 seeded random histories, simulation) |
| The course writes u = −Kx; RMD puts the sign inside K | research-c.md notation warnings |

## 4. Choosing

| Claim | Source |
|---|---|
| Industrial MPC uses a bias update as its feedback, which fails for integrating plants | Qin & Badgwell (2003) §3.4.1 (research-c.md §8a) |
| Robust stability under large model error is a separate question | RMD p. 53 ("Ch. 3, 5") (research-c.md §1c) |

## URLs used in the lesson's footnotes

- RMD PDF: https://sites.engineering.ucsb.edu/~jbraw/mpc/MPC-book-2nd-edition-6th-printing.pdf
- Qin & Badgwell: https://doi.org/10.1016/S0967-0661(02)00186-7
- Pannocchia & Rawlings: https://doi.org/10.1002/aic.690490213
- Muske & Badgwell: https://doi.org/10.1016/S0959-1524(01)00051-8
- Kalman: https://doi.org/10.1115/1.3662552
- Welch & Bishop: https://techreports.cs.unc.edu/papers/95-041.pdf
- Langson et al.: https://doi.org/10.1016/j.automatica.2003.08.009
- Mayne, Seron & Raković: https://doi.org/10.1016/j.automatica.2004.08.019

Not cited in the lesson (no claim depends on them): Maeder, Borrelli & Morari
(2009) and Pannocchia, Gabiccini & Artoni (2015), research-c.md §1d–1e.
