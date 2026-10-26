# M6 "稳定与可行：短视的代价 / Stability and feasibility": sources (as of 2026-10-26)

How things were checked: *fetched* means the page or PDF was fetched and the
cited text read (RMD page numbers by the previous M6 agent from the 6th-printing
PDF, see research-c.md §0; Crossref metadata for the DOIs). **(simulation)**
marks numbers from this repo's code (`packages/visuals/src/mpc/terminal_math.ts`,
unit-tested in `terminal_math.test.ts`): toy cart, Δt = 0.1 s, |a| up to 1 m/s²,
|v| up to 2 m/s, wall at 10 m, Q = diag(1, 0), R = 0.1, fallback = brake to
rest. Nothing here is a measurement. **(proof)** marks short arguments written
out in the lesson and checked by a test.

## 1. Rawlings, Mayne & Diehl (RMD), *Model Predictive Control: Theory, Computation, and Design*, 2nd ed., 6th printing

- PDF: https://sites.engineering.ucsb.edu/~jbraw/mpc/MPC-book-2nd-edition-6th-printing.pdf (fetched, research-c.md §0).
- **Def. 2.9, p. 110:** (control) invariant sets: a set is control invariant if from every point in it some admissible input keeps the next state in it. Used for "X_f is control invariant under braking".
- **pp. 111–112, recursive feasibility:** if X_f is control invariant, the shifted solution plus one step of the terminal control law is feasible at the next state, so a problem feasible once stays feasible. This is the lesson's shift-and-append derivation and the `mpc_shift_tail` figure.
- **Assumption 2.14, p. 114:** the basic stability assumption: X_f control invariant, and V_f(f(x, κ_f(x))) − V_f(x) ≤ −ℓ(x, κ_f(x)) on X_f (terminal cost decreases at least by the stage cost), plus the constraints satisfied by κ_f on X_f.
- **(2.17)/(2.18), pp. 117–118:** the cost-decrease argument V⁰(x⁺) ≤ V⁰(x) − ℓ(x, u₀), from the same candidate sequence; V⁰ is then a Lyapunov function. This is the lesson's `lyapunov` derivation.
- **pp. 131–132, soft constraints:** state constraints can be softened with slack variables penalised in the cost (and the controller can switch to the softened problem when the hard one is infeasible). Backs the `soft` page.
- **§2.5.4, pp. 136–137:** terminal cost = the LQR cost-to-go (Riccati P) and X_f a sublevel set of it / the maximal admissible set of the LQR closed loop, where u = −Kx keeps every constraint. The "textbook pair". The lesson's point that this pair degenerates when the target sits on a constraint is our own **(simulation + proof)**: the LQR closed loop has complex eigenvalues 0.875 ± 0.111i and overshoots past the wall from every state near the target (test "no neighbourhood of the target keeps p within 10").
- **§2.6 "Is a terminal constraint set X_f necessary?", pp. 144–146:** with a terminal cost βV_f and β large enough, stability holds without imposing X_f on a (smaller) region of attraction (Limon et al. 2006 cited there). Backs the `practice` page.

## 2. Papers (Crossref-verified DOIs)

- Mayne, Rawlings, Rao & Scokaert (2000). Constrained model predictive control: Stability and optimality. *Automatica* 36(6):789–814. https://doi.org/10.1016/S0005-1098(99)00214-9. The survey that states the terminal ingredients (X_f, V_f, κ_f) as the standard conditions.
- Keerthi & Gilbert (1988). Optimal infinite-horizon feedback laws for a general class of constrained discrete-time systems: stability and moving-horizon approximations. *JOTA* 57(2):265–293. https://doi.org/10.1007/BF00938540. The terminal equality constraint x_N = target.
- Gilbert & Tan (1991). Linear systems with state and control constraints: the theory and application of maximal output admissible sets. *IEEE TAC* 36(9):1008–1020. https://doi.org/10.1109/9.83532. The maximal admissible set used as X_f.
- Scokaert & Rawlings (1999). Feasibility issues in linear model predictive control. *AIChE J.* 45(8):1649–1659. https://doi.org/10.1002/aic.690450805. Infeasibility handling and soft constraints in linear MPC.
- Limon, Alamo, Salas & Camacho (2006). On the stability of constrained MPC without terminal constraint. *IEEE TAC* 51(5):832–836. https://doi.org/10.1109/TAC.2006.875014. A weighted terminal cost replaces X_f.
- Jadbabaie & Hauser (2005). On the stability of receding horizon control with a general terminal cost. *IEEE TAC* 50(5):674–678. https://doi.org/10.1109/TAC.2005.846597. Without terminal constraints, a long enough horizon gives stability (for the region considered). Backs "a long N works, but for which states and how long?"
- Kerrigan & Maciejowski (2000). Soft constraints and exact penalty functions in model predictive control. Proc. UKACC Int. Conf. (Control 2000), Cambridge, 4–7 Sept 2000, IET. Record fetched: https://spiral.imperial.ac.uk/entities/publication/b1d59b69-3901-41f5-bb9f-f619319fa9dc (handle http://hdl.handle.net/10044/1/10241). The full text was not reachable (404); the claim that the ℓ1 price must exceed the constraint's optimal Lagrange multiplier is taken from:
- Wu, Zhou & Braatz (2024). A Parallel Vector-form LDLᵀ Decomposition for Accelerating Execution-time-certified ℓ1-penalty Soft-constrained MPC. arXiv:2403.18235 (fetched): "a finite value is enough when the penalty weight ρ is larger than the corresponding optimal Lagrange multiplier value" (citing an optimisation textbook, Thm 14.3.1). A quadratic penalty alone needs an infinite weight.

## 3. Qin & Badgwell (2003), A survey of industrial model predictive control technology

*Control Engineering Practice* 11(7):733–764, https://doi.org/10.1016/S0967-0661(02)00186-7; PDF fetched from skoge.folk.ntnu.no (research-c.md §8a).
- p. 755: all products except DMC-plus enforce soft output constraints; hard output constraints can cause feasibility problems under large disturbances; constraints are ranked by priority.
- p. ~742: the soft formulation lets all constraints be violated to some extent.
- p. 757: the horizon is "generally set long enough to capture the steady-state effects".
- §5/§7: "None of the currently available industrial MPC algorithms makes full use of these ideas" (terminal ingredients); controllers are "not nominally stabilizing" and are "tested extensively through closed-loop simulation"; "practitioners do not perceive closed-loop stability … to be a serious problem".

## 4. Simulated numbers used in the lesson (simulation)

| Setting | Result |
|---|---|
| nothing at the end, N = 5 | crash certain from t = 5.1 s while the QP still has a solution (the trap), first QP without a solution at 5.6 s, hits at 1.55 m/s (t = 6.1 s) |
| nothing, N = 8 / 15 / 18 | hits at 1.18 / 0.54 / 0.14 m/s |
| nothing, N = 19 | docks at 7.3 s (shortest; M1) |
| LQR cost P only, N = 2..19 | still hits (N = 5 at 1.01 m/s; N = 19 at 0.06 m/s); N = 20 docks |
| terminal set p + 1.95 v up to 10, any N from 2 to 20 | never infeasible, never in the crash-certain region; docks (N = 2: 16.7 s, 5: 12.0 s, 8: 8.3 s) |
| end at target x_N = (10, 0) | infeasible at rest for N up to 69 (never moves); N = 70 docks at 7.1 s |
| trap at v = 2, N = 5 | p between 8 and 9.125 m |
| soft speed limit, N = 20, gust +0.4 m/s at 3 s | hard: 3 samples without a solution; l1 = 1000: same motion, slacks 0.3, 0.2, 0.1; l1 = 10: cruises at 2.78 m/s with no gust |

**(proof)** X_f = {p + c v up to 10, p up to 10, |v| up to 2}, c = v_max/a_max − Δt/2 = 1.95 s, is control invariant under κ_f = brake to rest: for v ≥ 0.1, one full-braking sample changes p + c v by 0.1 v − 0.2 (zero or less for v up to 2); for small v the cart stops within the sample; for v < 0, p does not grow. Tested on a grid. With c = 2 (the continuous-time value) the edge at 2 m/s would be left by 0.005 m per sample, hence −Δt/2.

**(proof)** The trap at speed v exists iff the window is shorter than the stop: the N-step braking distance vT − aT²/2 (T = NΔt) is smaller than v²/2a iff (v − aT)² > 0 with T < v/a. At 2 m/s: N up to 19 (tested).

**Caveat on 'set' mode:** κ_f is braking, not LQR, so the cost-decrease condition (Assumption 2.14) is not proven for our P; the lesson claims only feasibility and safety for the terminal-set controller, and labels its docking as observed in simulation.
