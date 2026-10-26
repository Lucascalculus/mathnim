# M3 "代价：想要什么 / The cost": verified sources (as of 2026-10-26)

How things were checked: *fetched* means I fetched the page or PDF and read the
quoted text myself. **(computed)** marks numbers from this repo's own code
(`packages/visuals/src/mpc/weights_math.ts`, unit-tested in
`weights_math.test.ts`), or from the lesson's Python listing, which I ran with
numpy 2.5.3 and scipy 1.18.1. **(inference)** marks my own reasoning.

## 1. Rawlings, Mayne & Diehl (RMD), *Model Predictive Control: Theory, Computation, and Design*, 2nd ed., 6th printing PDF

- PDF: https://sites.engineering.ucsb.edu/~jbraw/mpc/MPC-book-2nd-edition-6th-printing.pdf
  (fetched 2026-10-26; text extracted with pdftotext and read). Book page:
  https://sites.engineering.ucsb.edu/~jbraw/mpc/ (see research-c.md §0).
- **§1.3.1 Linear Quadratic Problem, pp. 11–12.**
  - The cost V = ½ Σ (x′Qx + u′Ru) + ½ x(N)′P_f x(N), where Q and R are "the
    tuning parameters".
  - "Large values of Q in comparison to R reflect the designer's intent to
    drive the state to the origin quickly at the expense of large control
    action." Large R relative to Q reduces the control action and slows the
    approach to the origin. These are the lesson's "what each weight buys"
    statements.
  - Choosing Q and R "is not always obvious … MPC inherits this tuning
    challenge."
  - "The constraints are the main feature that distinguishes MPC from the
    standard linear quadratic (LQ) control." This backs the 怎么选 page.
  - The assumptions are Q, P_f ⪰ 0 and R ≻ 0. They guarantee that the solution
    exists and is unique (this is why H ≻ 0 in the derivation).
- **§1.3.3 Dynamic Programming Solution, pp. 18–20.** The backward Riccati
  iteration (1.10), with Π(N) = P_f (1.11). The gain is
  K(k) = −(B′Π(k+1)B + R)⁻¹B′Π(k+1)A (1.13), and the cost to go is ½x′Π(k)x
  (1.14). **Sign convention:** RMD writes u = Kx with a minus sign inside K.
  The course writes u = −Kx, so the course's K = (R + B′PB)⁻¹B′PA.
- **§1.3.4 The Infinite Horizon LQ Problem, pp. 21–22.**
  - Using the first gain K(0) of a finite horizon need not stabilize the plant.
    RMD's example is unstable with N = 5, stable with N = 7, and stable with a
    margin as N → ∞. It quotes Kalman (1960) that optimality does not ensure
    stability.
  - Only the motivation is used, in one sentence pointing to M6.
- **§1.3.6 Convergence of the LQR, pp. 24–26.**
  - Lemma 1.3: for (A, B) controllable and Q, R ≻ 0, the infinite-horizon LQR
    gives a convergent closed loop. The gain and cost come from the DARE (1.18).
  - The conditions can be weakened to stabilizable, and to Q ⪰ 0 with (A, Q)
    detectable. **The cart uses Q = diag(1, q_v) with q_v possibly 0**, which
    is covered by this case **(inference: (A, Q^{1/2}) is detectable for the
    double integrator when position is weighted)**.
  - "if one cares little about the cost of the control, then R is chosen to
    be small, but positive definite."
- **§2.11 Notes, pp. 167–168.**
  - Sznaier and Damborg (1987) proposed taking the terminal cost as the value
    function of the unconstrained infinite-horizon problem.
  - Chmielewski & Manousiouthakis (1996) and Scokaert & Rawlings (1998)
    "showed that optimal control for the infinite horizon constrained optimal
    control problem for a specified initial state is achieved if the horizon
    is chosen sufficiently long."
  - Used in the 怎么选 page: MPC with the LQR terminal cost is "LQR plus
    constraints".
- Scokaert, P. O. M., & Rawlings, J. B. (1998). Constrained linear quadratic
  regulation. *IEEE Trans. Automatic Control* 43(8), 1163–1169. The reference
  is as listed in RMD's bibliography (fetched PDF). The paper itself was not
  fetched.

## 2. Bryson's rule (starting values for Q and R)

- MathWorks, `lqr` documentation:
  https://ch.mathworks.com/help/control/ref/lti.lqr.html (fetched 2026-10-26).
  - Bryson's rule sets each diagonal entry of Q (or R) to 1 / (the maximum
    acceptable value of that state (or input))².
  - "Although Bryson's rule usually provides satisfactory results, it is often
    just the starting point of a trial-and-error iterative design procedure."
  - The page cites no primary source. The rule is conventionally attributed to
    Bryson & Ho, *Applied Optimal Control* (1975), which I did not check, so
    the lesson names the rule without a citation to Bryson & Ho.

## 3. scipy `solve_discrete_are`

- https://docs.scipy.org/doc/scipy/reference/generated/scipy.linalg.solve_discrete_are.html
  (fetched 2026-10-26). It solves AᴴXA − X − (AᴴXB)(R + BᴴXB)⁻¹(BᴴXA) + Q = 0,
  with arguments (a, b, q, r).
- The kit's `dlqr` matches it to 1e-8 (math.test.ts, weights_math.test.ts).

## 4. Numbers the lesson shows (all simulations of the course's toy cart, Δt = 0.1 s)

All **(computed)**:
- With Q = diag(1, 0) and R = 0.1, using P = Q:
  - K_5 = [1.171, 0.444];
  - K_20 = [2.701, 2.323];
  - K_LQR = [2.789, 2.362];
  - with P = P_∞, K_1 = K_LQR.
  - Python listing in the lesson: output pasted from a run. Unit test: "K_N
    against the horizon".
- With q_v = 0.01 and r = 0.1:
  - K = [2.786, 2.377];
  - the first push is 6·k_p ≈ 16.7 m/s²;
  - the overshoot is about 25 cm;
  - the cart arrives within ±5 cm at 3.8 s.
- With q_v near 0, the overshoot is about 25 cm for every r (tested: 0.2–0.26 m
  across r = 0.1…100).
  - **(inference)** Continuous closed form (`continuous_lqr`, tested against
    the discrete gain when ωΔt is small): k_p = √(1/r) and
    k_v = √(q_v/r + 2√(1/r)), so ω = r^{−1/4} and ζ = √(1/2 + q_v/(4√r)).
  - With q_v = 0, ζ = 1/√2 for every r. The step overshoot of a second-order
    loop with this damping is e^{−π} ≈ 4.3 %, and 4.3 % of 6 m ≈ 26 cm.
  - r sets the pace (ω ∝ r^{−1/4}); q_v/√r sets the damping.
- 100× larger r gives roughly a tenth of the first push and is about 2.5× or
  more slower (tested).
- Brief A (arrive within 5 s, overshoot within 5 cm) is met, for example, at
  q_v ≈ 0.32, r = 0.1.
- Brief B (|a| never above 1 m/s², overshoot within 5 cm, arrive within 14 s)
  is met, for example, at q_v ≈ 6.3, r ≈ 50.
- No setting on the slider grid meets both briefs (tested exhaustively on a
  0.1-decade grid).
- With |a| kept within 1 m/s² by weights alone, the best arrival is about
  11 s. The fastest possible trip with |a| ≤ 1 (accelerate, then brake, over
  6 m) takes 2√6 ≈ 4.9 s (tested; bang-bang is a closed form, **inference**).
- Linear feedback scales with the error: from rest at distance d, the first
  push is a_0 = d·k_p. So 12 m with the entry weights gives
  12 × 2.786 ≈ 33.4 m/s².
