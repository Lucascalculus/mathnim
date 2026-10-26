"""L1: linear MPC for the course's cart with CVXPY and OSQP.

The cart starts at rest 10 m from a wall and must dock against it: end at
p = 10 with v = 0, never with |a| > 1 or |v| > 2, never past the wall.

    python L1_linear_mpc.py --exp base        # N = 20: plan 2 s ahead, dock
    python L1_linear_mpc.py --exp horizon     # N = 5 ... 40: hit the wall or dock; solve times
    python L1_linear_mpc.py --exp weights     # R = 0.01 ... 10: aggressive or gentle
    python L1_linear_mpc.py --exp rate        # add a limit on how fast a may change
    python L1_linear_mpc.py --exp terminal    # N = 10 plus "be able to stop": safe but slower
    python L1_linear_mpc.py --exp osqp        # the same QP straight into OSQP, no modelling layer
    python L1_linear_mpc.py --exp all --plot  # everything, figures in out/
    python L1_linear_mpc.py --exp base --margin 0   # no back-off from the wall: see the solver tolerance bite

CPU only; every experiment finishes in seconds.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

import cvxpy as cp
import numpy as np
import scipy.sparse as sp

from cart import A, A_MAX, B, DT, V_MAX, WALL, plant_step

OUT = Path(__file__).parent / "out"
X_REF = np.array([WALL, 0.0])  # the target: at the wall, at rest
# The controller keeps 1 mm from the wall (constraint back-off). OSQP solves to a tolerance and its plans can
# break a limit by a fraction of a millimetre; aiming at the wall with no margin, the cart then brushes it at
# about 1 cm/s at the end (try --margin 0). The cost still aims at p = 10, so it docks 1 mm short.
MARGIN = 1e-3


# ---------------------------------------------------------------- the MPC as a CVXPY problem
def build_mpc(N: int, q_p: float = 1.0, q_v: float = 0.0, r: float = 0.1,
              du_max: float | None = None, terminal: str | None = None) -> dict:
    """The horizon-N MPC, built once as a parametric problem: only x0 (and the
    previous input, for the rate limit) change from one sample to the next, so
    CVXPY compiles it once and every later solve reuses that work.

    cost  sum_k (x_k - x_ref)' Q (x_k - x_ref) + r a_k^2  +  (x_N - x_ref)' Q (x_N - x_ref)
    s.t.  x_{k+1} = A x_k + B a_k,  |a_k| <= 1,  |v_{k+1}| <= 2,  p_{k+1} <= 10
    """
    Q = np.diag([q_p, q_v])
    x0 = cp.Parameter(2, name="x0")
    u_prev = cp.Parameter(1, name="u_prev")
    X = cp.Variable((2, N + 1), name="X")
    U = cp.Variable((1, N), name="U")
    cost = 0
    cons = [X[:, 0] == x0]
    for k in range(N):
        cost += cp.quad_form(X[:, k] - X_REF, Q) + r * cp.square(U[0, k])
        cons += [
            X[:, k + 1] == A @ X[:, k] + B @ U[:, k],   # the model
            cp.abs(U[0, k]) <= A_MAX,                   # input limit
            cp.abs(X[1, k + 1]) <= V_MAX,               # speed limit
            X[0, k + 1] <= WALL - MARGIN,               # the wall (1 mm back-off for the solver's tolerance)
        ]
        if du_max is not None:                          # rate limit |a_k - a_{k-1}| <= du_max
            prev = u_prev[0] if k == 0 else U[0, k - 1]
            cons.append(cp.abs(U[0, k] - prev) <= du_max)
    cost += cp.quad_form(X[:, N] - X_REF, Q)            # terminal weight P = Q
    if terminal == "rest":
        cons.append(X[1, N] == 0)                       # end the plan at rest: it can always stop in time
    prob = cp.Problem(cp.Minimize(cost), cons)
    assert prob.is_dpp(), "the problem should be parametric (DPP) so CVXPY compiles it once"
    return {"prob": prob, "x0": x0, "u_prev": u_prev, "X": X, "U": U, "N": N}


# OSQP (ADMM): fast, warm-startable, moderate accuracy; "polish" refines the answer once
# the active constraints are known. Clarabel (interior point) is the accurate cross-check.
SOLVERS = {
    "osqp": dict(solver=cp.OSQP, warm_start=True, eps_abs=1e-6, eps_rel=1e-6, polish=True, max_iter=20000),
    "clarabel": dict(solver=cp.CLARABEL),
}
SOLVER = SOLVERS["osqp"]
USABLE = ("optimal", "optimal_inaccurate", "user_limit")  # a solution exists; the last two are flagged


def run(mpc: dict, steps: int = 120) -> dict:
    """The receding-horizon loop: measure, solve, apply the first input, repeat.
    When the QP is infeasible (no plan in the window can keep p <= 10) the cart
    brakes as hard as it can."""
    x = np.zeros(2)
    xs, us, wall_ms, osqp_ms, iters = [x.copy()], [], [], [], []
    first_infeasible, crash_t, impact, docked_t = None, None, 0.0, None
    flagged = 0  # solves that returned a solution but did not reach the requested accuracy
    a_prev = 0.0
    for k in range(steps):
        mpc["x0"].value = x
        mpc["u_prev"].value = np.array([a_prev])
        t0 = time.perf_counter()
        mpc["prob"].solve(**SOLVER)
        wall_ms.append(1e3 * (time.perf_counter() - t0))
        st = mpc["prob"].solver_stats
        if st.solve_time is not None:
            osqp_ms.append(1e3 * st.solve_time)
        iters.append(st.num_iters or 0)
        status = mpc["prob"].status
        if status in USABLE:
            a = float(mpc["U"].value[0, 0])
            flagged += status != "optimal"
        else:
            first_infeasible = first_infeasible if first_infeasible is not None else k * DT
            a = -A_MAX
        x, hit = plant_step(x, a)
        us.append(a)
        xs.append(x.copy())
        a_prev = a
        if hit > 1e-3:
            crash_t, impact = (k + 1) * DT, hit
            break
        if abs(x[0] - WALL) < 5e-3 and abs(x[1]) < 5e-3:
            docked_t = (k + 1) * DT
            break
    xs, us = np.array(xs), np.array(us)
    return {
        "N": mpc["N"],
        "outcome": "docked" if docked_t else ("hit the wall" if crash_t else "still moving"),
        "docked_t": docked_t, "crash_t": crash_t, "impact": round(impact, 3),
        "first_infeasible_t": first_infeasible, "flagged_solves": flagged,
        "max_abs_a": float(np.abs(us).max()), "max_v": float(xs[:, 1].max()), "max_p": float(xs[:, 0].max()),
        "max_abs_da": float(np.abs(np.diff(us)).max()) if len(us) > 1 else 0.0,
        "saturated_share": float(np.mean(np.abs(us) > A_MAX - 1e-3)),
        "solve_ms_median": float(np.median(wall_ms)), "solve_ms_max": float(np.max(wall_ms)),
        "osqp_ms_median": float(np.median(osqp_ms)) if osqp_ms else None,
        "osqp_iters_median": float(np.median(iters)),
        "_x": xs, "_u": us,
    }


def describe(res: dict, label: str) -> str:
    if res["outcome"] == "docked":
        end = f"docked at t = {res['docked_t']:.1f} s"
    elif res["outcome"] == "hit the wall":
        end = f"HIT THE WALL at {res['impact']:.2f} m/s (t = {res['crash_t']:.1f} s)"
    else:
        end = "still moving at the end"
    inf = f", first infeasible QP at t = {res['first_infeasible_t']:.1f} s" if res["first_infeasible_t"] is not None else ""
    if res["flagged_solves"]:
        inf += f", {res['flagged_solves']} solves flagged inaccurate"
    return (f"{label:<22} {end}{inf}; max|a| {res['max_abs_a']:.2f}, max v {res['max_v']:.2f}, "
            f"max|da| {res['max_abs_da']:.2f}; solve {res['solve_ms_median']:.1f} ms median "
            f"(OSQP itself {res['osqp_ms_median']:.2f} ms)")


# ---------------------------------------------------------------- experiments
def exp_base(plot: bool) -> dict:
    res = run(build_mpc(N=20))
    print(describe(res, "N = 20 (2 s)"))
    if plot:
        save_plot({"N = 20": res}, "L1_base.png")
    return {"base": strip(res)}


def exp_horizon(plot: bool) -> dict:
    out = {}
    for N in (5, 10, 15, 20, 25, 30, 40):
        res = run(build_mpc(N=N))
        print(describe(res, f"N = {N:>2} ({N * DT:.1f} s)"))
        out[f"N={N}"] = res
    if plot:
        save_plot({k: v for k, v in out.items() if k in ("N=10", "N=15", "N=20", "N=40")}, "L1_horizon.png")
    return {"horizon": {k: strip(v) for k, v in out.items()}}


def exp_weights(plot: bool) -> dict:
    out = {}
    for r in (0.01, 0.1, 1.0, 10.0):
        res = run(build_mpc(N=30, r=r), steps=200)
        print(describe(res, f"R = {r:<5} (N = 30)") + f"; at the limit {100 * res['saturated_share']:.0f}% of the time")
        out[f"R={r}"] = res
    res = run(build_mpc(N=30, q_v=1.0), steps=200)
    print(describe(res, "R = 0.1, Q_v = 1"))
    out["R=0.1,q_v=1"] = res
    if plot:
        save_plot(out, "L1_weights.png")
    return {"weights": {k: strip(v) for k, v in out.items()}}


def exp_rate(plot: bool) -> dict:
    out = {}
    for du in (None, 0.2, 0.05):
        res = run(build_mpc(N=30, du_max=du), steps=200)
        print(describe(res, f"|da| <= {du} per step" if du else "no rate limit"))
        out[f"du={du}"] = res
    if plot:
        save_plot(out, "L1_rate.png")
    return {"rate": {k: strip(v) for k, v in out.items()}}


def exp_terminal(plot: bool) -> dict:
    out = {}
    for label, kw in (("N = 10", dict(N=10)), ("N = 10 + rest at x_N", dict(N=10, terminal="rest")), ("N = 20", dict(N=20))):
        res = run(build_mpc(**kw), steps=200)
        print(describe(res, label))
        out[label] = res
    if plot:
        save_plot(out, "L1_terminal.png")
    return {"terminal": {k: strip(v) for k, v in out.items()}}


# ---------------------------------------------------------------- the same QP, straight into OSQP
def osqp_mpc(N: int, q_p: float = 1.0, q_v: float = 0.0, r: float = 0.1):
    """The sparse QP that CVXPY builds for us, written by hand:
    z = (x_0, ..., x_N, a_0, ..., a_{N-1});  min 1/2 z' P z + q' z  s.t.  l <= M z <= u.
    Only l and u (through x0) change between samples, so OSQP keeps its factorisation."""
    import osqp

    nx, nu = 2, 1
    Q = np.diag([q_p, q_v])
    P = sp.block_diag([sp.kron(sp.eye(N + 1), 2 * Q), sp.kron(sp.eye(N), 2 * r * np.eye(nu))], format="csc")
    q = np.hstack([np.kron(np.ones(N + 1), -2 * Q @ X_REF), np.zeros(N * nu)])
    # dynamics: -x_0 = -x0;  A x_k + B a_k - x_{k+1} = 0
    Ax = sp.kron(sp.eye(N + 1), -sp.eye(nx)) + sp.kron(sp.eye(N + 1, k=-1), A)
    Bu = sp.kron(sp.vstack([sp.csc_matrix((1, N)), sp.eye(N)]), B)
    Aeq = sp.hstack([Ax, Bu])
    # bounds on x_1..x_N (x_0 is fixed by the equality) and on a
    Aineq = sp.eye((N + 1) * nx + N * nu)
    xmin = np.tile([-np.inf, -V_MAX], N + 1)
    xmax = np.tile([WALL - MARGIN, V_MAX], N + 1)
    xmin[:2], xmax[:2] = -np.inf, np.inf
    lineq = np.hstack([xmin, -A_MAX * np.ones(N)])
    uineq = np.hstack([xmax, A_MAX * np.ones(N)])
    M = sp.vstack([Aeq, Aineq], format="csc")
    solver = osqp.OSQP()
    leq = np.zeros((N + 1) * nx)
    solver.setup(P, q, M, np.hstack([leq, lineq]), np.hstack([leq, uineq]),
                 eps_abs=1e-6, eps_rel=1e-6, max_iter=20000, verbose=False, warm_starting=True, polishing=True)

    def solve(x0: np.ndarray):
        leq[:nx] = -x0
        solver.update(l=np.hstack([leq, lineq]), u=np.hstack([leq, uineq]))
        res = solver.solve()
        ok = res.info.status in ("solved", "solved inaccurate")
        return (res.x[(N + 1) * nx] if ok else None), res.info.solve_time, res.info.iter
    return solve


def exp_osqp(plot: bool) -> dict:
    N = 20
    solve = osqp_mpc(N)
    x = np.zeros(2)
    a_cvx = strip(run(build_mpc(N=N)), keep=True)["_u"]
    us, ms_wall, ms_osqp, iters = [], [], [], []
    for _ in range(len(a_cvx)):
        t0 = time.perf_counter()
        a, t_osqp, it = solve(x)
        ms_wall.append(1e3 * (time.perf_counter() - t0))
        ms_osqp.append(1e3 * t_osqp)
        iters.append(it)
        a = -A_MAX if a is None else float(a)
        x, _ = plant_step(x, a)
        us.append(a)
    diff = float(np.max(np.abs(np.array(us) - np.array(a_cvx))))
    print(f"direct OSQP, N = {N}: {len(us)} solves, {np.median(ms_wall):.3f} ms median per solve "
          f"(OSQP's own time {np.median(ms_osqp):.3f} ms, {np.median(iters):.0f} iterations); "
          f"largest difference from the CVXPY inputs: {diff:.1e} m/s^2")
    return {"osqp": {"N": N, "solve_ms_median": float(np.median(ms_wall)), "osqp_ms_median": float(np.median(ms_osqp)),
                     "iters_median": float(np.median(iters)), "max_input_difference": diff}}


# ---------------------------------------------------------------- output
def strip(res: dict, keep: bool = False) -> dict:
    return res if keep else {k: v for k, v in res.items() if not k.startswith("_")}


def save_plot(runs: dict, name: str) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(3, 1, figsize=(7, 7), sharex=True)
    for label, res in runs.items():
        t = np.arange(len(res["_x"])) * DT
        ax[0].plot(t, res["_x"][:, 0], label=label)
        ax[1].plot(t, res["_x"][:, 1])
        ax[2].step(t[:-1], res["_u"], where="post")
    ax[0].axhline(WALL, color="k", lw=1)
    ax[0].set_ylabel("p (m)")
    ax[1].axhline(V_MAX, color="r", ls="--", lw=1)
    ax[1].set_ylabel("v (m/s)")
    for s in (-1, 1):
        ax[2].axhline(s * A_MAX, color="r", ls="--", lw=1)
    ax[2].set_ylabel("a (m/s²)")
    ax[2].set_xlabel("t (s)")
    ax[0].legend(fontsize=8)
    fig.tight_layout()
    OUT.mkdir(exist_ok=True)
    fig.savefig(OUT / name, dpi=110)
    print(f"  figure: {OUT / name}")


EXPERIMENTS = {"base": exp_base, "horizon": exp_horizon, "weights": exp_weights, "rate": exp_rate,
               "terminal": exp_terminal, "osqp": exp_osqp}

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--exp", default="base", choices=[*EXPERIMENTS, "all"])
    ap.add_argument("--plot", action="store_true", help="save figures to out/")
    ap.add_argument("--solver", default="osqp", choices=list(SOLVERS), help="QP solver behind CVXPY")
    ap.add_argument("--margin", type=float, default=MARGIN, help="how far the controller keeps from the wall [m] (default 0.001)")
    args = ap.parse_args()
    SOLVER = SOLVERS[args.solver]
    MARGIN = args.margin
    results = {}
    for name in (EXPERIMENTS if args.exp == "all" else [args.exp]):
        print(f"--- {name}")
        results.update(EXPERIMENTS[name](args.plot))
    OUT.mkdir(exist_ok=True)
    (OUT / f"L1_{args.exp}_{args.solver}.json").write_text(json.dumps(results, indent=1))
