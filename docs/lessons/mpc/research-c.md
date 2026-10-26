# MPC course, M7 and M8: verified sources (as of 2026-10-26)

Scope: M7 "模型不准时" (disturbances, offset-free MPC, Kalman filter, tube MPC) and
M8 "非线性 MPC 与怎么选" (NMPC, shooting, SQP/RTI, bicycle-model path tracking,
learning + MPC, the PID / LQR / MPC / NMPC / RL decision page).

**How things were checked.**
- *verified 2026-10-26 via fetch*: I fetched the URL itself, or the Crossref
  record for the DOI (`api.crossref.org/works/<doi>`), and the title, authors,
  year and venue matched. Where I quote content, it comes from a page or PDF I
  fetched and read: an abstract, an author PDF, or the book PDF.
- *via search result*: confirmed only through web-search result text (snippets
  or summaries). Treat the wording as approximate.
- *not verified*: stated as such, with the best alternative I could find.
- **(inference)** marks my own reasoning or calculation, not a claim from a
  source.

ScienceDirect (Elsevier), Springer and Annual Reviews landing pages blocked
automated fetching (HTTP 403 or a bot challenge). For those works I verified the
DOI through Crossref and took the content from an abstract (via OpenAlex or the
publisher), an author copy, or the Rawlings–Mayne–Diehl book. Each entry says
which.

**Notation warnings for lesson authors.**
- The course uses Q and R as **cost weights**. Kalman-filter sources use Q and R
  for **noise covariances** (Welch & Bishop: w ~ N(0,Q), v ~ N(0,R); they also
  call the measurement matrix H and the measurement z). In M7, rename the noise
  covariances, for example to W and V or Q_w and R_v.
- Rawlings–Mayne–Diehl (RMD) use n_d for the number of disturbances, p for the
  number of measurements, H for selecting the controlled variables
  (r = Hy), and x̄, ū for the nominal (tube-centre) system. The brief's
  u = v + K(x − z) is the same thing written with z ≡ x̄ and v ≡ ū.

---

## 0. The single most useful source: the RMD book (free PDF)

**Rawlings, J. B., Mayne, D. Q., & Diehl, M. M. *Model Predictive Control:
Theory, Computation, and Design*, 2nd ed. Nob Hill Publishing.** First printing
Oct 2017; paperback 3rd printing Oct 2020; the PDF now posted is the 6th
printing (May 2026).
- Book page: https://sites.engineering.ucsb.edu/~jbraw/mpc/ (verified
  2026-10-26 via fetch). It links free PDFs of the text for the 1st, 3rd and
  6th printings, plus appendices, exams and errata.
- PDF (6th printing): https://sites.engineering.ucsb.edu/~jbraw/mpc/MPC-book-2nd-edition-6th-printing.pdf
  (verified 2026-10-26 via fetch: HTTP 200, application/pdf, 3.76 MB; text
  extracted and read). The 3rd-printing PDF also returns 200 (5.9 MB).
- Page numbers below are from the 6th-printing PDF.
- Sections M7/M8 can cite directly:
  - §1.5.2 "Disturbances and Zero Offset", pp. 49–53: offset-free MPC.
  - §1.4.2 "Linear Optimal State Estimation", p. 29: Kalman filter.
  - §3.5 "Tube-Based Robust MPC", pp. 223–235, and §3.8 Notes, p. 259.
  - §8.5.1–8.5.2 "Direct Single / Multiple Shooting", pp. 532–537.
  - §8.9.1 "General Algorithmic Considerations", pp. 568–570: preparation and
    feedback phases.
  - §8.9.2 "Continuation Methods and Real-Time Iterations", pp. 571–574.

---

## 1. Offset-free MPC

### 1a. Muske & Badgwell (2002)
Muske, K. R., & Badgwell, T. A. (2002). Disturbance modeling for offset-free
linear model predictive control. *Journal of Process Control*, 12(5), 617–632.
- URL: https://doi.org/10.1016/S0959-1524(01)00051-8. DOI metadata verified
  2026-10-26 via fetch (Crossref). doi.org redirects to Elsevier linkinghub,
  and ScienceDirect returned 403.
- Abstract content: **via search result** (ScienceDirect snippet, extended web
  search).
- What we use:
  - Most industrial MPC assumes a **constant output disturbance**. That can
    reject disturbances that enter elsewhere in the process only sluggishly.
  - The paper gives a general disturbance model for unmeasured disturbances
    that enter through the **input, the state or the output**.
  - It states conditions that guarantee **detectability of the augmented
    model**.
  - It adds a **steady-state target calculation** that removes the effect of
    the estimated disturbances.
  - It states conditions for offset-free control of the combined estimator,
    target calculation and dynamic controller.
- Corroborated by Qin & Badgwell (2003), §3.4.1 (entry 8a, fetched). For
  stable plants, the constant-output-disturbance ("bias") model gives integral
  action. For integrating and unstable plants it **fails, because the
  estimator contains the unstable poles of the process**. The fix is an input
  or state disturbance model. The total number of disturbances cannot exceed
  the number of measured outputs.

### 1b. Pannocchia & Rawlings (2003)
Pannocchia, G., & Rawlings, J. B. (2003). Disturbance models for offset-free
model-predictive control. *AIChE Journal*, 49(2), 426–437.
- URL: https://doi.org/10.1002/aic.690490213. Verified 2026-10-26 via fetch:
  the Wiley landing page and the Crossref record. Abstract read via OpenAlex.
- What we use, from the abstract:
  - Offset-free MPC works by adding **integrating disturbances** to the model.
    They lump plant–model mismatch and unmodelled disturbances together.
  - With p measured outputs and m inputs (p > m), at most m controlled
    variables can be tracked without offset. Using only m integrating
    disturbances is **not** enough in general.
  - **A number of integrating disturbances equal to the number of measured
    variables is sufficient** for zero offset in the controlled variables.
  - The results hold for square and non-square plants, and for open-loop
    stable, integrating and unstable plants.
- RMD Lemma 1.10 (next entry) says its proof "is given in Pannocchia and
  Rawlings (2003)".

### 1c. The exact statements to put on screen (RMD §1.5.2, pp. 49–53; fetched and read)
- **Augmented model (1.43).**
  - x⁺ = A x + B_d d + B u + w
  - d⁺ = d + w_d
  - y = C x + C_d d + v

  The integrating disturbance d is driven by white noise w_d. In a
  deterministic slide, write d⁺ = d.
- **Choice of B_d and C_d.** "We are free to choose how the integrating
  disturbance affects the states and measured outputs through the choice of
  B_d and C_d. The only restriction is that the augmented system is
  detectable."
- **Lemma 1.8 (detectability).** The augmented system is detectable iff
  (A, C) is detectable and

      rank [ I − A   −B_d ]
           [   C      C_d ]  =  n + n_d .
- **Corollary 1.9.** n_d ≤ p, where p is the number of measurements.
- **Estimation.** x and d are estimated with a Kalman filter designed for the
  augmented system. The noise variances "may be treated as adjustable
  parameters". The forecast of the steady-state disturbance is d̂_s = d̂(k).
- **Target problem (1.45).**

      min over (x_s, u_s):  ½|u_s − u_sp|²_{R_s} + ½|C x_s + C_d d̂_s − y_sp|²_{Q_s}

  subject to

      [ I − A  −B ] [x_s]   [ B_d d̂_s          ]
      [ H C     0 ] [u_s] = [ r_sp − H C_d d̂_s ]

  plus input constraints and output constraints shifted by C_d d̂_s. The
  regulator then drives x̂ − x_s to the origin.
- **Lemma 1.10 (offset-free control).** Assume the target problem is feasible.
  Use n_d = p disturbances with rank [I−A, −B_d; C, C_d] = n + p. *If* the
  plant output goes to a steady state y_s, the closed loop is stable, and
  constraints are not active at steady state, *then* H y_s = r_sp (zero
  offset).
- **Why n_d = p (p. 53).** At steady state the disturbance update forces
  L_d(y − C x̂ − C_d d̂) = 0. Only n_d = p makes L_d square and free of a
  nullspace, so the output prediction error must be zero.
- **Mismatch claim, verbatim in substance (p. 53).** "Lemma 1.10 does not
  require that the plant output be generated by the model. The theorem applies
  regardless of what generates the plant output." Stabilizing the loop under
  mismatch is a separate question (Ch. 3, 5).
- **PID analogy (p. 49).** Integral action in PID gives the same either/or:
  - without constraints, either zero offset or an unbounded trajectory;
  - with constraints, additionally, constraints are active at steady state.
- **(inference) Running example check for M7.** Cart with Δt = 0.1, position
  measured only (p = 1), constant slope or headwind entering as acceleration.
  - Choose **B_d = B, C_d = 0** (input disturbance). The rank matrix is
    [[0, −Δt, −Δt²/2], [0, 0, −Δt], [1, 0, 0]]. Its determinant is Δt² ≠ 0, so
    the rank is 3 = n + n_d. ✔
  - The "output bias" choice **B_d = 0, C_d = 1** gives
    [[0, −Δt, 0], [0, 0, 0], [1, 0, 1]]. Its rank is 2 < 3, so it is **not
    detectable**.
  - This is the integrating-plant failure that Qin & Badgwell describe. It
    makes a good "why not just add a bias?" moment. Verify both in the lab code.

### 1d. Maeder, Borrelli & Morari (2009)
Maeder, U., Borrelli, F., & Morari, M. (2009). Linear offset-free Model
Predictive Control. *Automatica*, 45(10), 2214–2222.
- URL: https://doi.org/10.1016/j.automatica.2009.06.005. DOI metadata verified
  2026-10-26 via fetch (Crossref).
- The ScienceDirect page (pii S0005109809002969) appeared in search results,
  but its abstract could **not** be retrieved: 403, and no OpenAlex abstract.
- What we can say, from a **secondary** source: Son, Kim, Oh & Lee,
  arXiv:2012.02753v2, §2. Fetched 2026-10-26 and read.
  - It presents "the standard linear offset-free MPC framework in Pannocchia
    and Rawlings (2003); Maeder, Borrelli and Morari (2009)". This is the same
    augmented model x⁺ = Ax + Bu + B_d d, d⁺ = d, y = Cx + C_d d, with the
    same target equations as RMD.
  - When n_d = n_y, Proposition 2 of Maeder et al. implies L_d is nonsingular,
    and the simple estimator gain structure gives offset-free tracking.
  - For n_d < n_y, Maeder et al. give gain-construction procedures
    (Algorithms 4.2 and 4.3).
- Recommendation: cite Maeder et al. only as "the standard framework (with
  Pannocchia & Rawlings)". Take every formula from RMD §1.5.2.

### 1e. Pannocchia, Gabiccini & Artoni (2015): the tutorial and review you asked about (it exists)
Pannocchia, G., Gabiccini, M., & Artoni, A. (2015). Offset-free MPC explained:
novelties, subtleties, and applications. *IFAC-PapersOnLine*, 48(23), 342–351.
It was an invited semi-plenary at the 5th IFAC NMPC conference in Seville.
- URL: https://doi.org/10.1016/j.ifacol.2015.11.304. DOI metadata verified
  2026-10-26 via fetch (Crossref). Abstract read via OpenAlex. The
  author-repository record (arpi.unipi.it) returned 403.
- What we use, from the abstract:
  - An updated, comprehensive treatment for nonlinear and linear
    discrete-time systems, with "a strong accent on the role of the
    disturbance model and observer".
  - It shows the **velocity-form algorithm** (Δu formulation) is equivalent to
    a particular disturbance model and observer. That is useful if a learner
    asks "why not just penalise Δu / add integral action?".
  - It gives application examples that "clarify misconceptions and design
    errors that can prevent constraint satisfaction, closed-loop stability, and
    offset-free performance".

---

## 2. Kalman filter

### 2a. Kalman (1960)
Kalman, R. E. (1960). A New Approach to Linear Filtering and Prediction
Problems. *Journal of Basic Engineering* (Trans. ASME), 82(1), 35–45.
- URL: https://doi.org/10.1115/1.3662552. DOI metadata verified 2026-10-26 via
  fetch (Crossref). Abstract read via OpenAlex.
- What we use, from the abstract:
  - It uses the state-transition method. The same formulation covers
    stationary and nonstationary statistics.
  - It derives a nonlinear difference/differential equation for the **error
    covariance**. The filter coefficients follow from it "without further
    calculations".
  - "The filtering problem is shown to be the dual of the noise-free regulator
    problem." This is the one-line bridge to LQR (M3) and to "LQG = LQR +
    Kalman".

### 2b. Welch & Bishop: accessible tutorial
Welch, G., & Bishop, G. *An Introduction to the Kalman Filter*. TR 95-041,
Dept. of Computer Science, UNC Chapel Hill. Updated April 5, 2004.
- URL: https://techreports.cs.unc.edu/papers/95-041.pdf. Verified 2026-10-26
  via fetch: PDF read, and the header matches.
- The older URLs `cs.unc.edu/~welch/media/pdf/kalman_intro.pdf` and
  `cs.unc.edu/~welch/kalman/` now return **404**. Do not use them.
- What we use:
  - Model x_k = A x_{k−1} + B u_{k−1} + w_{k−1} and z_k = H x_k + v_k, with
    w ~ N(0,Q) and v ~ N(0,R). **Rename Q and R in our lessons.**
  - **Time update ("predict")**: x̂⁻_k = A x̂_{k−1} + B u_{k−1}, and
    P⁻_k = A P_{k−1} Aᵀ + Q.
  - **Measurement update ("correct")**: K_k = P⁻_k Hᵀ (H P⁻_k Hᵀ + R)⁻¹;
    x̂_k = x̂⁻_k + K_k (z_k − H x̂⁻_k); P_k = (I − K_k H) P⁻_k.
  - Tuning:
    - R is usually measured offline from sensor data.
    - Q is harder to set. A simple (poor) model can still work if enough
      uncertainty is "injected" via Q.
    - Both are often tuned.
- Also free: the "The Kalman Filter [Control Bootcamp]" video and its MATLAB
  example in Brunton's playlist (entry 9d).

---

## 3. Tube MPC

### 3a. Mayne, Seron & Raković (2005)
Mayne, D. Q., Seron, M. M., & Raković, S. V. (2005). Robust model predictive
control of constrained linear systems with bounded disturbances. *Automatica*,
41(2), 219–224.
- URL: https://doi.org/10.1016/j.automatica.2004.08.019. DOI metadata verified
  2026-10-26 via fetch (Crossref). Abstract content **via search result** (the
  University of Newcastle repository record; the repository host did not
  resolve when fetched).
- What we use:
  - The abstract (via search) says the online optimal control problem
    includes, uniquely, the **initial state of the nominal model as a decision
    variable**.
  - Its value function is zero in a **disturbance-invariant set** that plays
    the role of the "origin". The result is robust exponential stability of
    that set.
- RMD §3.5.4, pp. 233–235 (fetched): this is the "improved tube-based MPC". The
  nominal centre z is re-optimised subject to x ∈ {z} ⊕ S_K(∞).
- RMD §3.8 Notes, p. 259: "The tube-based controllers described above are
  based on the papers (Langson, Chryssochoos, Raković, and Mayne, 2004; Mayne,
  Serón, and Raković, 2005)."

### 3b. Langson, Chryssochoos, Raković & Mayne (2004)
Langson, W., Chryssochoos, I., Raković, S. V., & Mayne, D. Q. (2004). Robust
model predictive control using tubes. *Automatica*, 40(1), 125–133.
- URL: https://doi.org/10.1016/j.automatica.2003.08.009. DOI metadata verified
  2026-10-26 via fetch (Crossref). The abstract was **not** retrieved.
- Cite it as the origin of the tube idea alongside 3a. Take all formulas from
  RMD.

### 3c. Formulas to show (RMD §3.5.1–3.5.3, pp. 223–230; fetched and read)
- **Why tubes.** Robust MPC over all disturbance sequences multiplies the
  constraints by the number of sequences M. The book says this "can thus
  exceed 10⁶ in process control applications".
- **Tube idea.**
  - All trajectories of the uncertain system lie in a bounded neighbourhood
    (the "tube") of a nominal trajectory.
  - Make the nominal trajectory satisfy **tightened constraints** computed
    offline.
  - Then "the online computational requirements are similar to those for
    nominal MPC".
- **Plant and nominal model.** Plant x⁺ = Ax + Bu + w, w ∈ W (compact,
  convex, containing 0). Nominal x̄⁺ = Ax̄ + Bū.
- **Ancillary feedback.** u = ū + K(x − x̄). The error e = x − x̄ obeys
  e⁺ = A_K e + w with A_K = A + BK, which is stable by design.
- **Without feedback the tube grows (book example).** For x⁺ = x + u + w with
  W = [−1, 1], open loop gives S(i) = (i+1)W, which grows without bound. With
  K = −½: A_K = ½, S_K(∞) = 2W = [−2, 2]. A nice 1-D slider demo for M7.
- **Disturbance-invariant set.** S_K(∞) = Σ_j A_K^j W. It is robustly positive
  invariant: e ∈ S_K(∞) ⇒ e⁺ ∈ S_K(∞). It is the *minimal* RPI set for
  e⁺ = A_K e + w. Its exact computation "is known to be difficult", and the
  book shows alternatives (§3.5.3, p. 230).
- **Constraint tightening.**
  - X̄ = X ⊖ S_K(∞) and Ū = U ⊖ K S_K(∞), with Pontryagin difference
    A ⊖ B = {x : {x} ⊕ B ⊆ A}.
  - If the nominal (x̄, ū) satisfy the tightened constraints, the real (x, u)
    satisfy the originals.
- **Two components (§3.5.3).**
  1. A nominal trajectory, computed by standard MPC on the nominal model with
     the tightened constraints.
  2. The feedback u = ū + K(x − x̄) "that attempts to steer the uncertain
     state-control trajectory to the nominal trajectory".
- **Result (Proposition 3.12).** S_K(∞) × {0} is robustly asymptotically
  stable: the real state converges to the set S_K(∞) around the origin, not
  to the origin itself.

---

## 4. Nonlinear MPC numerics

### 4a. Bock & Plitt (1984): direct multiple shooting
Bock, H. G., & Plitt, K. J. (1984). A Multiple Shooting Algorithm for Direct
Solution of Optimal Control Problems. Proc. 9th IFAC World Congress, Budapest.
Reprinted in *IFAC Proceedings Volumes*, 17(2), 1603–1608.
- URL: https://doi.org/10.1016/S1474-6670(17)61205-9. DOI metadata verified
  2026-10-26 via fetch (Crossref). The RMD bibliography lists the original
  proceedings as pp. 242–247. The abstract was not retrieved.
- What we use, from RMD §8.5.2, pp. 534–537 (fetched):
  - Multiple shooting makes the same control discretisation as single
    shooting, but keeps the **interval-boundary states s_i as decision
    variables**. That decouples the integrations on different intervals.
  - Advantages over single shooting:
    - the integrations can run in parallel;
    - the s_i can be initialised from data;
    - Newton-type contraction is often faster, "in particular for nonlinear
      and unstable systems".
  - Disadvantage: globalisation must also monitor the continuity (dynamic)
    constraint residuals.
  - Single shooting's appeal: every iterate is a "physical" trajectory.
  - RMD p. 556: the exact Hessian of the multiple-shooting Lagrangian is block
    diagonal (Bock and Plitt, 1984).
- The CasADi paper (5a, fetched) credits "direct multiple shooting by Bock and
  Plitt" and direct collocation as the two popular direct methods. "Both …
  exhibit good convergence properties and can be easily parallelized."

### 4b. Diehl, Bock, Schlöder, Findeisen, Nagy & Allgöwer (2002): RTI origin
Diehl, M., Bock, H. G., Schlöder, J. P., Findeisen, R., Nagy, Z., &
Allgöwer, F. (2002). Real-time optimization and nonlinear model predictive
control of processes governed by differential-algebraic equations. *Journal of
Process Control*, 12(4), 577–585.
- URL: https://doi.org/10.1016/S0959-1524(01)00023-3. DOI metadata verified
  2026-10-26 via fetch (Crossref).
- Author copy: https://lirias.kuleuven.be/retrieve/80043. Verified 2026-10-26
  via fetch; the PDF was read and its journal header matches.
- What we use:
  - **Initial value embedding.** The steps of an SQP iteration that do not
    need the new measured state are done *in advance*. "The first iteration is
    available in a small fraction of the time of a whole SQP iteration."
  - **The real-time iteration cycle.**
    - (I) *Feedback response*: after observing the state, solve the
      (condensed) QP and apply the result immediately.
    - (II) *Preparation phase*: expand to the full QP solution, take the full
      step, then prepare linearisations for the next sample.
    - "In each cycle the same steps as for one classical SQP iteration are
      performed, but in a rotated order."
    - It does **not** iterate SQP to convergence. The error of the first
      iterate is second order in the size of the perturbation; this also holds
      for generalized Gauss–Newton.
  - "The feedback phase itself is typically orders of magnitude shorter than
    the preparation phase."
  - **Shift vs no shift.** Either shift all variables by one sample, or warm
    start with the unshifted iterate. "For short sampling times, both
    strategies have shown nearly identical performance."
  - **Numbers.** Distillation column with a 164th-order model, prediction
    horizon 6000 s (2400 + 3600 s), 20 control intervals, sampling time 10 s.
    Max/avg CPU time per problem was 9.7 s / 4.6 s for N = 20 (2.6 / 1.6 s for
    N = 5) on a Compaq Alpha XP1000. That is 2002 hardware; present it only as
    history.

### 4c. Diehl, Bock & Schlöder (2005): RTI theory
Diehl, M., Bock, H. G., & Schlöder, J. P. (2005). A Real-Time Iteration Scheme
for Nonlinear Optimization in Optimal Feedback Control. *SIAM J. Control and
Optimization*, 43(5), 1714–1736.
- URL: https://doi.org/10.1137/S0363012902400713. DOI metadata verified
  2026-10-26 via fetch (Crossref). Abstract read via OpenAlex.
- What we use, from the abstract:
  - A Newton-type scheme delivers **approximations of the optimal feedback
    control that are iteratively refined during the runtime of the process**.
  - **Contractivity is proven.** There is a **bound on the loss of
    optimality** compared with the exact optimal solution.
  - The demo controls an unstable system: an airborne kite flying loops.

### 4d. Gros, Zanon, Quirynen, Bemporad & Diehl (2020): linear MPC to RTI, for the linear-MPC audience
Gros, S., Zanon, M., Quirynen, R., Bemporad, A., & Diehl, M. (2020). From linear
to nonlinear MPC: bridging the gap via the real-time iteration. *International
Journal of Control*, 93(1), 62–80. Published online 2016.
- URL: https://doi.org/10.1080/00207179.2016.1222553. DOI metadata verified
  2026-10-26 via fetch (Crossref).
- Author PDF: https://publications.syscop.de/Gros2020b.pdf. Verified
  2026-10-26 via fetch and read.
- **The best single source for the M8 RTI page.** What we use:
  - RTI solves "only one properly formulated QP per sampling instant". It "can
    be seen as a special case of linear time-varying MPC".
  - In some applications it needs computational times "only marginally larger
    than linear MPC" (abstract).
  - **Algorithm 3 (RTI).**
    - *Preparation phase*, over [t_{i−1}, t_i):
      1. shift the previous solution to get a guess;
      2. evaluate residuals and sensitivities (linearise) at the guess;
      3. form the QP without x̂_i, doing condensing and factorisations in
         advance.
    - *Feedback phase*, at t_i when x̂_i arrives:
      4. insert x̂_i and solve the QP;
      5. take the **full Newton step**.
  - The **Gauss–Newton Hessian** is "usually" used. It needs no second
    derivatives and is always positive (semi)definite.
  - The feedback phase costs "practically the same as the time required to
    solve the linear MPC problem". RTI can often run "at the same sampling
    frequency of linear MPC".
  - **The key framing.** "Linear MPC can be regarded as an RTI scheme where the
    preparation phase is performed only once, off-line." Linear MPC is RTI
    linearised at the reference rather than at the current prediction.
  - **Shifting.** The previous solution is shifted one step to warm-start the
    next problem (their Fig. 2). Initial value embedding is how the QP is built
    from the shifted guess even when the measured state differs.

### 4e. RMD §8.9 (pp. 568–574; fetched): textbook wording for M8
- *Preparation/feedback split* (§8.9.1). Do the long work in advance, using a
  predicted state. When the new state estimate arrives, do only a short
  computation, such as u₁ = v + K(x₁ − x̄₁) or one condensed QP. "The
  introduction of the feedback phase reduces the delay to unforeseen
  disturbances from Δt to Δt_fb." The feedback is then an approximation.
- *RTI* (§8.9.2):
  - One SQP-type iteration per new parameter (state) value.
  - With the exact Hessian it is a "generalized tangential predictor". SQP
    RTI can "jump" across active-set changes.
  - With a Gauss–Newton Hessian you get approximate predictors and linear
    rather than quadratic convergence.
  - "A shift strategy perturbs the contraction of the real-time iterations
    and needs to be applied with care". It is not beneficial for
    time-invariant problems with a short horizon and a tight terminal cost or
    constraint.

---

## 5. Software

### 5a. CasADi
Andersson, J. A. E., Gillis, J., Horn, G., Rawlings, J. B., & Diehl, M. (2019).
CasADi: a software framework for nonlinear optimization and optimal control.
*Mathematical Programming Computation*, 11(1), 1–36. Published online
2018-07-11.
- DOI: https://doi.org/10.1007/s12532-018-0139-4. Metadata verified 2026-10-26
  via fetch (Crossref).
- Author PDF: https://publications.syscop.de/Andersson2019.pdf. Verified via
  fetch and read; the journal header matches.
- Website: https://web.casadi.org/. Verified 2026-10-26 via fetch.
- What we use:
  - Open-source and general-purpose. It aims at more flexibility than
    algebraic modelling languages (AMPL, GAMS, JuMP, Pyomo), with "special
    interest" in problems constrained by differential equations, that is,
    optimal control.
  - Written in C++, used mainly through Python, MATLAB or Octave. In use since
    late 2009.
  - It began as an algorithmic-differentiation tool; the focus has shifted to
    optimisation.
  - The website lists NLP plug-ins (including **IPOPT**), QP plug-ins
    (including qpOASES, HPIPM) and SUNDIALS integrators. It can export C code.

### 5b. Ipopt
Wächter, A., & Biegler, L. T. (2006). On the implementation of an
interior-point filter line-search algorithm for large-scale nonlinear
programming. *Mathematical Programming*, 106(1), 25–57. Published online 2005.
- DOI: https://doi.org/10.1007/s10107-004-0559-y. Metadata verified 2026-10-26
  via fetch (Crossref).
- Project page: https://coin-or.github.io/Ipopt/ redirects to
  https://www.coin-or.org/Ipopt/. Verified 2026-10-26 via fetch.
- What we use:
  - From the project page: Ipopt finds a **local** solution of
    f(x) → min subject to nonlinear constraints with bounds, using an
    "interior point line search filter method". Functions should be twice
    continuously differentiable. It is free under the EPL.
  - From the paper abstract, **via search result**: a primal-dual
    interior-point method with filter line search, feasibility restoration,
    second-order corrections and inertia correction, tested on 954 CUTEr
    problems.

### 5c. acados
Verschueren, R., Frison, G., Kouzoupis, D., Frey, J., van Duijkeren, N.,
Zanelli, A., Novoselnik, B., Albin, T., Quirynen, R., & Diehl, M. (2022).
acados—a modular open-source framework for fast embedded optimal control.
*Mathematical Programming Computation*, 14(1), 147–183. Published online
2021-10-09.
- DOI: https://doi.org/10.1007/s12532-021-00208-8. Metadata verified 2026-10-26
  via fetch (Crossref).
- arXiv: https://arxiv.org/abs/1910.13753. Verified via fetch.
- Docs: https://docs.acados.org/. Verified 2026-10-26 via fetch.
- What we use:
  - From the arXiv abstract: solvers for fast embedded optimisation, written
    in C on the **BLASFEO** linear-algebra library. It has MATLAB and Python
    interfaces, uses **CasADi** for modelling, and is BSD-2-licensed.
  - From the docs: nonlinear and economic MPC; MHE; **multiple shooting**;
    integrators with sensitivities; "fast SQP-type solvers"; structure
    exploitation with QP solvers such as **HPIPM**, plus condensing.
  - The docs landing page I fetched did not name "RTI". **(inference)**
    acados exposes an RTI variant of its SQP solver; check the docs before
    stating it.

### 5d. do-mpc (venue correction: it is *Control Engineering Practice*, not *Computers & Chemical Engineering*)
Fiedler, F., Karg, B., Lüken, L., Brandner, D., Heinlein, M., Brabender, F., &
Lucia, S. (2023). do-mpc: Towards FAIR nonlinear and robust model predictive
control. *Control Engineering Practice*, 140, 105676.
- DOI: https://doi.org/10.1016/j.conengprac.2023.105676. Metadata verified
  2026-10-26 via fetch (Crossref). Abstract read via OpenAlex.
- Site: https://www.do-mpc.com/ and docs https://www.do-mpc.com/en/latest/.
  Both verified 2026-10-26 via fetch.
- What we use:
  - The abstract names four obstacles to adoption of advanced MPC:
    unavailable models, deploying complex controllers, too few rapid
    prototyping tools, and poor reproducibility.
  - do-mpc adds: interoperability with neural-network toolboxes for system
    identification; OPC UA for deployment; a data-sampling framework for
    approximate MPC.
  - The site calls it a Python toolbox for robust MPC and MHE. Features:
    nonlinear and economic MPC, DAEs, orthogonal collocation, **robust
    multi-stage MPC**.

### 5e. OSQP
Stellato, B., Banjac, G., Goulart, P., Bemporad, A., & Boyd, S. (2020). OSQP:
an operator splitting solver for quadratic programs. *Mathematical Programming
Computation*, 12(4), 637–672.
- DOI: https://doi.org/10.1007/s12532-020-00179-2. Metadata verified
  2026-10-26 via fetch (Crossref).
- arXiv: https://arxiv.org/abs/1711.08013 (v4, 12 Feb 2020). Verified via
  fetch; full PDF read.
- Site: https://osqp.org/. Verified 2026-10-26 via fetch.
- What we use:
  - ADMM-based, with no requirements on the data beyond convexity. It can be
    division-free after one factorisation. It reliably detects primal and dual
    infeasibility.
  - It supports **factorisation caching and warm starting**. It is "typically
    ten times faster than competing interior-point methods" (abstract).
  - §6, parametric programs: when only q, l, u change (linear MPC: the state
    enters only the bounds or the linear term), the KKT factorisation is done
    once and reused. Warm start uses the previous (x*, y*).
  - **MPC benchmark (§8.4, Table 7):**
    - setup: random stable systems, n_x = 20/40/60/80 states, n_u = n_x/2,
      horizon T = 10, 100 closed-loop steps, accuracy 10⁻³;
    - time in seconds without vs with warm start and caching: 0.007 → 0.002
      (n_x = 20), 0.014 → 0.005, 0.035 → 0.013, 0.067 → 0.022 (n_x = 80);
    - the text reports a "2.6 to 4-fold time improvement from factorization
      caching"; iteration counts barely drop because cold start already needs
      few iterations.
  - Hardware: MIT SuperCloud, Intel Xeon E5-2650. QDLDL single-threaded
    linear solver.
  - **(inference)** The table does not say "per QP". The iteration columns
    (≈30) look like per-solve averages, so the times are most likely per QP.
    Say "milliseconds per QP on a server CPU in the authors' benchmark", and
    let L1 measure the learner's own times.
  - The general benchmarks (Table 1) are relative: shifted geometric means
    normalised to the fastest solver. They are not absolute times.

### 5f. CVXPY
Diamond, S., & Boyd, S. (2016). CVXPY: A Python-Embedded Modeling Language for
Convex Optimization. *Journal of Machine Learning Research*, 17(83), 1–5.
- URL: https://jmlr.org/papers/v17/15-408.html. Verified 2026-10-26 via fetch.
- arXiv: https://arxiv.org/abs/1603.00943. Verified via fetch.
- Site: https://www.cvxpy.org/. Verified 2026-10-26 via fetch.
- What we use:
  - You write problems in a syntax that follows the math, not a solver
    standard form.
  - cvxpy.org lists **OSQP** among the open-source solvers it relies on
    (alongside Clarabel, SCS and HiGHS).

---

## 6. Vehicle model (M8 running example)

### 6a. Kong, Pfeiffer, Schildbach & Borrelli (2015)
Kong, J., Pfeiffer, M., Schildbach, G., & Borrelli, F. (2015). Kinematic and
dynamic vehicle models for autonomous driving control design. *2015 IEEE
Intelligent Vehicles Symposium (IV)*, 1094–1099.
- URL: https://doi.org/10.1109/IVS.2015.7225830. DOI metadata verified
  2026-10-26 via fetch (Crossref). Abstract read via OpenAlex.
- Author PDF (borrelli.me.berkeley.edu) did **not resolve** (DNS failure), so
  I did not read the full text.
- What we use, from the abstract:
  - It compares kinematic and dynamic models by the statistics of their
    **forecast error** on experimental data, and studies the effect of
    discretisation.
  - It motivates MPC with "a simple kinematic bicycle model". This is "less
    computationally expensive than existing methods which use vehicle tire
    models" and "can be implemented at low vehicle speeds where tire models
    become singular".
  - Experiments were run at various speeds on windy roads.
  - Polack et al. 2018 (6c) summarise Kong et al. as concluding that the
    kinematic model "works better in most cases, except at high-speed".
    **Secondary source.**
- **Correction to the brief.** The well-known validity bound "lateral
  acceleration below 0.5 µg" comes from **Polack et al. 2017** (6b), **not**
  from Kong et al.

### 6b. Polack, Altché, d'Andréa-Novel & de La Fortelle (2017): validity bound
Polack, P., Altché, F., d'Andréa-Novel, B., & de La Fortelle, A. (2017). The
kinematic bicycle model: A consistent model for planning feasible trajectories
for autonomous vehicles? *2017 IEEE Intelligent Vehicles Symposium (IV)*,
812–818.
- URL: https://doi.org/10.1109/IVS.2017.7995816. DOI metadata verified
  2026-10-26 via fetch (Crossref). Abstract read via OpenAlex.
- What we use:
  - It compares the kinematic bicycle model with a 9-DoF model and proposes a
    consistency criterion.
  - The criterion, as stated by the same authors in 6c (fetched): "the lateral
    acceleration should always remain lower than 0.5µg, where µ is the road
    friction coefficient."

### 6c. Polack et al. (2018): source of the equations I could read
Polack, P., Altché, F., d'Andréa-Novel, B., & de La Fortelle, A. (2018).
Guaranteeing Consistency in a Motion Planning and Control Architecture Using a
Kinematic Bicycle Model. ACC 2018.
- URL: https://arxiv.org/abs/1804.08290. Verified 2026-10-26 via fetch; PDF
  read.
- Equations (1a–f), which they cite to Rajamani (2012):
  - Ẋ = V cos(ψ + β)
  - Ẏ = V sin(ψ + β)
  - ψ̇ = (V / l_r) sin β
  - V̇ = u₁ (acceleration)
  - δ̇ = u₂ (steering rate)
  - **β = atan( l_r / (l_f + l_r) · tan δ )**, the slip angle at the centre of
    gravity.
- "This model does not take into account the vehicle's dynamics such as
  slipping and skidding." Their MPC planner runs at 10 Hz, with PID low-level
  control at 100 Hz.
- **(inference)** For M8, inputs (a, δ) are simpler than (a, δ̇). Kong et al.
  very likely use the same β-form with steering angle as input, but I did not
  read their full text.

### 6d. Rajamani, *Vehicle Dynamics and Control* (book)
Rajamani, R. (2012). *Vehicle Dynamics and Control*, 2nd ed. Springer,
Mechanical Engineering Series.
- URL: https://doi.org/10.1007/978-1-4614-1433-9. DOI metadata verified
  2026-10-26 via fetch (Crossref).
- The SpringerLink page returned a bot challenge and was not read.
- Ch. 2 "Lateral Vehicle Dynamics", pp. 15–46,
  https://doi.org/10.1007/978-1-4614-1433-9_2 (Crossref verified). According
  to a search result, it covers kinematic and dynamic models of lateral motion.
- Polack et al. 2018 cite this book for the kinematic bicycle equations.

### 6e. Falcone, Borrelli, Asgari, Tseng & Hrovat (2007)
Falcone, P., Borrelli, F., Asgari, J., Tseng, H. E., & Hrovat, D. (2007).
Predictive Active Steering Control for Autonomous Vehicle Systems. *IEEE
Transactions on Control Systems Technology*, 15(3), 566–580.
- URL: https://doi.org/10.1109/TCST.2007.894653. DOI metadata verified
  2026-10-26 via fetch (Crossref). Abstract read via OpenAlex.
- What we use:
  - MPC computes the **front steering angle** to follow a known trajectory on
    slippery roads at the highest possible entry speed.
  - **Two formulations**: (1) a nonlinear vehicle model (full NMPC), and (2)
    **successive online linearisation** of the model (LTV MPC), which is
    cheaper.
  - Validated in simulation and in experiments **up to 21 m/s on icy roads**.
  - This is a good real case for M8's "NMPC vs linearise-every-step" choice,
    and it connects to RTI (4d).

---

## 7. Learning and MPC

### 7a. Hewing, Wabersich, Menner & Zeilinger (2020)
Hewing, L., Wabersich, K. P., Menner, M., & Zeilinger, M. N. (2020).
Learning-Based Model Predictive Control: Toward Safe Learning in Control.
*Annual Review of Control, Robotics, and Autonomous Systems*, 3, 269–296.
- URL: https://doi.org/10.1146/annurev-control-090419-075625. DOI metadata
  verified 2026-10-26 via fetch (Crossref). Abstract read via OpenAlex.
- The Annual Reviews page returned 403, so the full text was not read.
- What we use, from the abstract:
  - MPC is "the prime methodology for constrained control". It can exploit
    data "in a reliable manner, particularly while taking safety constraints
    into account".
  - **Three categories:**
    1. learning to improve the **prediction model** from recorded data (most
       of the work);
    2. learning the MPC **parameterisation** (cost, constraints) for the best
       closed-loop performance;
    3. using MPC to give **learning-based controllers** constraint-satisfaction
       properties (safety filters).

### 7b. Rosolia & Borrelli (2018): learning MPC for iterative tasks
Rosolia, U., & Borrelli, F. (2018). Learning Model Predictive Control for
Iterative Tasks. A Data-Driven Control Framework. *IEEE Transactions on
Automatic Control*, 63(7), 1883–1896.
- URL: https://doi.org/10.1109/TAC.2017.2753460. DOI metadata verified
  2026-10-26 via fetch (Crossref).
- arXiv: https://arxiv.org/abs/1609.01387. Verified via fetch.
- What we use:
  - The controller is reference-free. It **improves from previous iterations**
    of the same task (for example, laps).
  - A **safe set and a terminal cost built from stored trajectories** of past
    iterations guarantee recursive feasibility. Performance does not get worse
    from iteration to iteration: the arXiv abstract says "non-increasing" (the
    cost) and the TAC abstract says "nondecreasing performance".
  - It ties directly back to M6: terminal set and terminal cost, here learned
    from data.

### 7c. Neural-network approximation of explicit MPC (two papers)
- **Chen, S., Saulnier, K., Atanasov, N., Lee, D. D., Kumar, V., Pappas, G. J.,
  & Morari, M. (2018).** Approximating Explicit Model Predictive Control Using
  Constrained Neural Networks. *2018 American Control Conference (ACC)*,
  1520–1527.
  - URL: https://doi.org/10.23919/ACC.2018.8431275. DOI metadata verified
    2026-10-26 via fetch (Crossref). Abstract read via OpenAlex.
  - The optimal MPC law for constrained LQR is **piecewise affine on
    polytopes**, but computing it becomes intractable for large problems.
  - They train a ReLU network with a modified policy-gradient method that uses
    the model.
  - Feasibility is guaranteed by **projecting** onto polytopes derived from
    the maximal control invariant set.
- **Karg, B., & Lucia, S. (2020).** Efficient Representation and Approximation
  of Model Predictive Control Laws via Deep Learning. *IEEE Transactions on
  Cybernetics*, 50(9), 3866–3878.
  - URL: https://doi.org/10.1109/TCYB.2020.2999556 and
    https://arxiv.org/abs/1806.10644. Both verified 2026-10-26 via fetch.
  - ReLU networks can **exactly represent** the piecewise-affine linear MPC
    law. Deep networks represent exponentially more affine regions than
    single-layer ones. The paper gives bounds on depth and width.
  - "The online evaluation of neural networks is extremely simple", which
    suits low-power embedded devices. Approximation error must be corrected
    or quantified.
- These connect to M4's "the controller is piecewise affine".

### 7d. MPC vs RL
- **Görges, D. (2017).** Relations between Model Predictive Control and
  Reinforcement Learning. *IFAC-PapersOnLine*, 50(1), 4920–4928.
  - URL: https://doi.org/10.1016/j.ifacol.2017.08.747. DOI metadata verified
    2026-10-26 via fetch (Crossref). Abstract read via OpenAlex.
  - It covers linear time-invariant systems with state and input constraints
    and a quadratic value function.
  - MPC theory gives the structure: the optimal **value function is piecewise
    quadratic** on polyhedra, and the **policy is piecewise affine**.
  - It proposes exploiting this structure in RL for stability and feasibility
    criteria and faster learning.
- **Recht, B. (2019).** A Tour of Reinforcement Learning: The View from
  Continuous Control. *Annual Review of Control, Robotics, and Autonomous
  Systems*, 2, 253–279.
  - URL: https://doi.org/10.1146/annurev-control-053018-023825. DOI metadata
    verified 2026-10-26 via fetch (Crossref).
  - arXiv: https://arxiv.org/abs/1806.09460. v2, 10 Nov 2018, fetched and
    read. Quotes below are from arXiv v2; check the wording against the
    journal version if you quote it.
  - Abstract (journal): "theory and experiment demonstrate the role and
    importance of models and the cost of generality in reinforcement learning
    algorithms."
  - The **double-integrator** case study is *our cart*. One simulation of 10
    samples with white-noise input gives a nominal (model-based, certainty-
    equivalence) estimate "correct to 3 digits of precision", which "returns a
    nearly optimal control policy". "Policy gradient, in particular requires
    thousands of times as many samples as simple nominal control."
  - On a harder LQR instance: "Not only are model-free methods sample hungry,
    but they fail to be safe. And safety is much more critical than sample
    complexity."

---

## 8. Applications

### 8a. Qin & Badgwell (2003): industrial MPC survey
Qin, S. J., & Badgwell, T. A. (2003). A survey of industrial model predictive
control technology. *Control Engineering Practice*, 11(7), 733–764.
- DOI: https://doi.org/10.1016/S0967-0661(02)00186-7. Metadata verified
  2026-10-26 via fetch (Crossref).
- Full text: https://skoge.folk.ntnu.no/prost/publications_various/mpc_survey_qin.pdf
  (copy hosted at NTNU; it shows the CEP 11 (2003) 733–764 header). Verified
  2026-10-26 via fetch; text extracted and read.
- Numbers (all from the paper):
  - **Table 6, linear MPC applications**: total **4542**. The table footnote
    calls them estimates from a vendor survey that exclude licensees'
    in-house applications, and the numbers are "a snapshot survey conducted
    in mid-1999".
  - By area: refining 1985, petrochemicals 550, chemicals 144, pulp & paper
    68, food processing 51, furnaces 45, mining/metallurgy 37, polymer 17,
    utility 14, aerospace/defense 13, air & gas 10, automotive 7, unclassified
    1601.
  - **Table 7, nonlinear MPC applications**: total **93**. Most are in
    chemicals 22, polymers 21, air & gas 18.
  - Text: "More than 4600 total MPC applications are reported in Tables 6 and
    7". Refining "amounts to 67% of all classified applications".
  - Caveats: vendors defined "application" themselves, and an automobile
    engine controller may count once "even when several thousand copies … are
    sold". Do not read the counts as market share.
  - NMPC applications are "typically much smaller" in size and scope, "likely
    due to the computational complexity of NMPC algorithms."
  - Largest linear application: an olefins plant with **603 outputs and 283
    inputs** (AspenTech).
- Also useful for M7 and the decision page:
  - Fig. 2 hierarchy: basic PID control "every second", MPC dynamic
    constraint control "every minute", local optimisation "every hour".
  - MPC replaces "a combination of PID algorithms, lead-lag blocks and
    high/low select logic".
  - Refining and petrochemical controllers "run on the order of once each
    minute".
  - The bias-update feedback that industry uses fails for purely integrating
    systems (§1a).

### 8b. Di Carlo, Wensing, Katz, Bledt & Kim (2018): MIT Cheetah 3
Di Carlo, J., Wensing, P. M., Katz, B., Bledt, G., & Kim, S. (2018). Dynamic
Locomotion in the MIT Cheetah 3 Through Convex Model-Predictive Control. *2018
IEEE/RSJ IROS*, 1–9.
- URL: https://doi.org/10.1109/IROS.2018.8594448. DOI metadata verified
  2026-10-26 via fetch (Crossref). Abstract read via OpenAlex.
- What was controlled: the **ground reaction forces** of a torque-controlled
  quadruped.
- Dynamics are simplified so the problem is **convex** (a QP) but still 3-D.
- **Horizons up to 0.5 s, solved to optimality in under 1 ms, at 20–30 Hz.**
- Gaits include trot, flying trot, pronk, bound, pace, a 3-legged gait and a
  3-D gallop. Speeds up to 3 m/s forward, 1 m/s lateral, 180°/s yaw, all
  with one set of gains and weights.

### 8c. Kamel et al. (2017): UAV trajectory tracking with ROS
- **Chapter.** Kamel, M., Stastny, T., Alexis, K., & Siegwart, R. (2017).
  Model Predictive Control for Trajectory Tracking of Unmanned Aerial Vehicles
  Using Robot Operating System. In *Robot Operating System (ROS): The Complete
  Reference (Vol. 2)*, Studies in Computational Intelligence (vol. 707 per a
  search result), Springer, pp. 3–39.
  - DOI: https://doi.org/10.1007/978-3-319-54927-9_1. Metadata verified
    2026-10-26 via fetch (Crossref). The chapter text was not read.
- **Code.** https://github.com/ethz-asl/mav_control_rw. Verified 2026-10-26
  via fetch.
  - The README lists `mav_linear_mpc`, `mav_nonlinear_mpc` and a PID attitude
    controller.
  - A "disturbance observer based on Kalman Filter is implemented to achieve
    offset-free tracking". **This is a real-world M7 example.**
- **Companion paper with numbers.** Kamel, M., Burri, M., & Siegwart, R.
  (2017). Linear vs Nonlinear MPC for Trajectory Tracking Applied to Rotary
  Wing Micro Aerial Vehicles. *IFAC-PapersOnLine*, 50(1), 3463–3469.
  - https://doi.org/10.1016/j.ifacol.2017.08.849 (Crossref verified) and
    https://arxiv.org/abs/1611.09240 (fetched; PDF read).
  - Platform: AscTec NEO hexacopter with an onboard i7 running ROS.
  - LMPC uses a **CVXGEN** QP; NMPC uses **ACADO** with an **RTI,
    Gauss–Newton** scheme.
  - Both run at **100 Hz**, with internal prediction at 10 Hz over **20 steps
    (2 s horizon)**.
  - External forces are estimated by an augmented-state EKF for offset-free
    tracking.
  - Average solve time: **0.45 ms (NMPC, RTI) vs 2.35 ms (LMPC)**.
  - Aggressive tracking under wind: RMSE **7.1 cm (NMPC) vs 10.8 cm (LMPC)**.
  - **(inference)** The NMPC is faster here because of RTI and code
    generation. Do not generalise to "NMPC is always faster".

### 8d. Automotive production and prototypes
- **Bemporad, A., Bernardini, D., Long, R., & Verdejo, J. (2018).** Model
  Predictive Control of Turbocharged Gasoline Engines for Mass Production.
  *SAE Technical Paper* 2018-01-0875.
  - https://doi.org/10.4271/2018-01-0875. Crossref verified 2026-10-26;
    abstract read via OpenAlex.
  - Multivariable constrained MPC for **engine torque tracking**, "scheduled
    for production by General Motors starting in calendar year 2018",
    co-developed by GM and ODYS.
  - It is a set of **linear MPCs scheduled on operating conditions**, each
    with a model from system identification and **its own Kalman filter**.
  - It coordinates throttle, wastegate, and intake and exhaust cams. The MPC
    core runs in production engine control units.
- **Hrovat, D., Di Cairano, S., Tseng, H. E., & Kolmanovsky, I. V. (2012).**
  The development of Model Predictive Control in automotive industry: A
  survey. *2012 IEEE Int. Conf. Control Applications*, 295–302.
  - https://doi.org/10.1109/CCA.2012.6402735. Crossref verified; abstract via
    OpenAlex.
  - A survey of MPC in automotive work, with a focus on **Ford**. It presents
    three applications prototyped in "fully functional production-like
    vehicles".

---

## 9. Books and prerequisites

### 9a. Rawlings, Mayne & Diehl
See §0. Book page and PDF verified 2026-10-26 via fetch.

### 9b. Borrelli, Bemporad & Morari, *Predictive Control for Linear and Hybrid Systems*
Cambridge University Press, 2017.
- DOI: https://doi.org/10.1017/9781139061759. Metadata verified 2026-10-26 via
  fetch (Crossref). Description read via OpenAlex: stability, feasibility,
  robustness, explicit MPC, and a free MATLAB toolbox.
- **No free author-hosted PDF could be verified.**
  - `mpc.berkeley.edu/mpc-course-material` returned 403.
  - The guessed `.../MPC_Book.pdf` returned 404.
  - Search found only paid editions.
- Link the DOI or the Cambridge page. Do not promise a free PDF.

### 9c. Boyd & Vandenberghe, *Convex Optimization*
Cambridge University Press, 2004.
- Page: https://web.stanford.edu/~boyd/cvxbook/. Verified 2026-10-26 via
  fetch: the authors say CUP "kindly agreed to allow us to keep the book
  available on the web".
- PDF: https://web.stanford.edu/~boyd/cvxbook/bv_cvxbook.pdf. Verified via
  fetch of headers: HTTP 200, application/pdf, 6.9 MB.
- Book DOI: https://doi.org/10.1017/CBO9780511804441 (Crossref verified).

### 9d. Steve Brunton, Control Bootcamp (YouTube)
https://www.youtube.com/playlist?list=PLMrJAkhIeNNR20Mz-VpzgfQs5zrYi085m
- Verified 2026-10-26 via fetch: title "Control Bootcamp", owner Steve Brunton,
  39 videos.
- Videos relevant to M7/M8:
  - "The Kalman Filter [Control Bootcamp]";
  - "Control Bootcamp: Kalman Filter Example in Matlab";
  - "Control Bootcamp: Linear Quadratic Gaussian (LQG)";
  - "Control Bootcamp: Cruise Control Example with Proportional-Integral (PI)
    control";
  - "Control Bootcamp: Introduction to Robust Control";
  - "Model Predictive Control".

---

## Facts for the decision page (PID vs LQR vs linear MPC vs NMPC vs RL)

Keep these claims modest. Cells marked "standard" are textbook facts I did not
source to a fetched page this session.

| | Model needed | Online compute | Constraints | Data needed |
|---|---|---|---|---|
| **PID** | None in the controller; tuned on the plant (standard) | Trivial per sample (standard) | Not in the design; handled by add-ons (clipping, anti-windup, select logic) [Q&B] | Tuning experiments; auto-tuning PID "very successful in the marketplace" [Q&B §6.2] |
| **LQR** | Linear (A, B) + weights Q, R (M3) | Offline Riccati; online u = Kx (standard) | None; saturating an LQR can hurt badly [Q&B citing Goodwin] | Model (identified or physics) |
| **Linear MPC** | Linear model + constraints + disturbance model for offset-free [RMD §1.5.2] | One QP per sample: ms on a server CPU for n_x ≤ 80, T = 10 [OSQP Table 7]; < 1 ms at 20–30 Hz for Cheetah 3 [Di Carlo]; once a minute in refineries [Q&B] | Explicit, by design (M4) | Model; industrial models come from step tests/identification [Q&B §5; Bemporad 2018] |
| **NMPC** | Nonlinear model (e.g., bicycle) | One NLP per sample (CasADi + Ipopt), or RTI: one QP per sample plus linearisation [Gros 2020]; 0.45 ms RTI on a hexacopter [Kamel] | Explicit, nonlinear; solutions are local [Ipopt page] | Model; 93 vs 4542 industrial apps in 1999 [Q&B] |
| **RL** | None explicit (model-free) or learned | Cheap policy evaluation online (NN) [Karg & Lucia]; expensive training (inference) | No built-in guarantee; MPC can act as a safety layer [Hewing] | Large: policy gradient used "thousands of times" more samples than nominal control on a double integrator [Recht] |

Sourced statements behind the table:

- **PID, constraints and structure.**
  - Qin & Badgwell (8a): in conventional plants, constraint handling is "a
    combination of PID algorithms, lead-lag (L/L) blocks and high/low select
    logic". In the MPC methodology "this combination of blocks is replaced by
    a single MPC controller". PID stays at the base layer (Fig. 2: basic
    control every second, MPC every minute).
  - Auto-tuning PID "very successful in the marketplace" is Qin & Badgwell
    §6.2.
- **PID integral action and offset.** RMD §1.5.2, p. 49: integral action
  gives zero offset, or an unbounded trajectory, or active constraints at
  steady state. RMD says the zero-offset objective of the disturbance-model
  approach "is similar to what one achieves when using the integral mode" of
  PID.
- **LQR vs MPC under constraints.** Qin & Badgwell §5: "Goodwin et al. (2001)
  give an example where unconstrained LQR solution with anti-windup has
  significant performance deterioration compared to an MPC solution under
  severe constraints." This is second-hand: Goodwin et al. was not fetched.
- **LQR ↔ Kalman.** Kalman (1960): filtering is "the dual of the noise-free
  regulator problem".
- **Linear MPC speed.**
  - OSQP (5e): ms-level QPs on a server CPU; warm start and factorisation
    caching give 2.6–4× speed-ups; "typically ten times faster than competing
    interior-point methods".
  - Cheetah 3 (8b): 0.5 s horizon, < 1 ms solve, 20–30 Hz.
  - Refinery MPC runs about once a minute (8a).
  - Production automotive MPC: GM 2018 (8d).
- **Explicit MPC.** For linear MPC the law is piecewise affine and can be
  precomputed; neural networks can represent or approximate it (Chen 2018;
  Karg & Lucia 2020; Görges 2017).
- **NMPC cost.**
  - Gros et al. (4d): RTI solves one QP per sample. Its feedback time is
    "practically the same" as linear MPC's. RTI "can in many cases be applied
    at the same sampling frequency of linear MPC". Linear MPC is RTI with the
    preparation done once offline.
  - Kamel (8c): 0.45 ms NMPC-RTI vs 2.35 ms LMPC on a hexacopter at 100 Hz.
  - Qin & Badgwell: NMPC applications are fewer and smaller, "likely due to
    the computational complexity".
  - Ipopt finds a **local** solution (5b), so NMPC quality depends on the
    initial guess. That is why warm start and shift matter (4b, 4d).
- **NMPC vs linearise-every-step.** Falcone et al. (6e) implement both
  (nonlinear model vs successive online linearisation) and discuss their
  complexity and performance trade-off.
- **RL data and safety.**
  - Recht (7d): on the double integrator, model-based nominal control is near
    optimal from 10 samples, while policy gradient needs "thousands of times
    as many samples". "Not only are model-free methods sample hungry, but they
    fail to be safe."
  - Hewing et al. (7a): MPC offers a reliable way to use data "while taking
    safety constraints into account", including augmenting learning-based
    controllers with constraint satisfaction.
- **Learning + MPC, not either/or.**
  - Learn the model (Hewing category 1).
  - Learn the terminal set and cost from past laps (Rosolia & Borrelli).
  - Distil MPC into a network for cheap online evaluation (Chen; Karg & Lucia).
  - Use MPC structure to guide RL (Görges).

**(inference) Suggested decision-card wording, synthesised from the above and
not quoted from any one source:**
- **PID**: single loop, no hard limits that matter, no model.
- **LQR**: a good linear model, limits rarely hit, the cheapest optimal
  feedback.
- **Linear MPC**: limits matter and a linear model is good near the operating
  point. A QP each sample.
- **NMPC**: limits matter and the nonlinearity matters (e.g., large steering,
  wide speed range). Use RTI when time is tight.
- **RL**: no usable model, many cheap safe trials or a simulator, and no hard
  safety guarantees needed — or combine it with MPC.

---

## Corrections and gaps relative to the brief

1. **do-mpc venue.** The 2023 paper is in *Control Engineering Practice* 140,
   105676, not *Computers & Chemical Engineering*. A Crossref title search
   confirms it. The DOI I first guessed in Computers & Chemical Engineering
   belongs to an unrelated paper.
2. **The 0.5 µg validity bound** for the kinematic bicycle model is from
   Polack et al. (IV 2017), not Kong et al. (2015).
3. **Borrelli–Bemporad–Morari free PDF:** not found. Link the DOI.
4. **Welch & Bishop:** the old `~welch` URLs are 404. Use
   techreports.cs.unc.edu/papers/95-041.pdf.
5. **OSQP timings** are per-QP-level milliseconds on a server, for random
   stable systems with n_x = 20–80 and T = 10 (Table 7). The headline
   comparisons are relative (shifted geometric means). Measure the cart in L1
   instead of quoting.
6. **Abstracts not retrieved:**
   - Maeder et al. 2009: content only via a secondary source (1d).
   - Langson et al. 2004.
   - Bock & Plitt 1984.
   - Mayne et al. 2005: abstract via search result only.
   - Muske & Badgwell 2002: via search result only.
   - For formulas, cite RMD, which I read in full for the relevant sections.
7. **Not read in full:** Kong et al. 2015, Hewing et al. 2020, Kamel et al.
   2017 chapter, Rajamani. Only abstracts or secondary descriptions; see each
   entry.
