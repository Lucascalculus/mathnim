"""M5 measurements: how long the course's cart MPC takes to solve, on this machine.

Everything here is the course's docking task (README "Running example", KIT.md):
double integrator, dt = 0.1 s, state x = (p, v), input a; |a| <= 1 m/s^2,
|v| <= 2 m/s, p <= 10 m; cost sum (p - 10)^2 + 0.1 a^2 with terminal weight Q;
start at rest at p = 0, 90 samples of closed loop on the exact model.

It writes docs/lessons/mpc/m5/bench.json with
- machine and library versions;
- time per QP against the horizon N, for two formulations (condensed: inputs
  only, dense; sparse: states and inputs, dynamics as equalities) and two
  solver families (OSQP = ADMM; Clarabel = interior point), OSQP cold and
  warm-started from the shifted previous plan;
- iterations per sample over one closed-loop run (N = 20);
- an early-termination experiment: OSQP limited to k iterations per sample,
  warm vs cold, and what the closed loop then does (wall, speed, cost).

Run:  python3 docs/lessons/mpc/m5/bench.py          (about five minutes)
Times are wall-clock seconds around solve() (time.perf_counter), so they
include the Python call overhead; each closed loop is repeated and the median
per sample is kept. They depend on the machine: only the shapes and ratios
carry over to yours.
"""
from __future__ import annotations

import json
import platform
import subprocess
import sys
import time
from pathlib import Path

import numpy as np
import scipy
import scipy.sparse as sp
import osqp
import clarabel

DT = 0.1
A = np.array([[1.0, DT], [0.0, 1.0]])
B = np.array([[DT * DT / 2], [DT]])
Q = np.diag([1.0, 0.0])
R = np.array([[0.1]])
P = Q.copy()
A_MAX, V_MAX, WALL = 1.0, 2.0, 10.0
XREF = np.array([WALL, 0.0])
X0 = np.array([0.0, 0.0])
STEPS = 90
n, m = 2, 1

OSQP_SET = dict(verbose=False, eps_abs=1e-3, eps_rel=1e-3, polishing=False,   # OSQP's default accuracy
                adaptive_rho_interval=25,   # fixed: the default adapts by wall time and is not repeatable
                check_termination=1,        # test every iteration, so iteration counts are exact
                max_iter=4000)


# ----------------------------------------------------------------------------- formulations
class Sparse:
    """Variables z = (x_1..x_N, u_0..u_{N-1}); dynamics as equality rows; x0 only in their bounds."""

    def __init__(self, N: int):
        self.N = N
        nx, nu = N * n, N * m
        self.nz = nx + nu
        Qs = [Q] * (N - 1) + [P]
        self.P = sp.block_diag([sp.kron(sp.eye(1), 2 * q) for q in Qs] + [2 * R] * N, format="csc")
        self.q = np.concatenate([np.concatenate([-2 * q @ XREF for q in Qs]), np.zeros(nu)])
        # equalities: x_{k+1} - A x_k - B u_k = 0 (k = 0: = A x0)
        Ax = sp.kron(sp.eye(N), sp.eye(n)) + sp.kron(sp.eye(N, k=-1), -A)
        Bu = sp.kron(sp.eye(N), -B)
        Aeq = sp.hstack([Ax, Bu])
        Aineq = sp.eye(self.nz)
        self.A = sp.vstack([Aeq, Aineq], format="csc")
        xlo = np.tile([-np.inf, -V_MAX], N)
        xhi = np.tile([WALL, V_MAX], N)
        self.lo_in = np.concatenate([xlo, -A_MAX * np.ones(nu)])
        self.hi_in = np.concatenate([xhi, A_MAX * np.ones(nu)])
        self.neq = N * n

    def bounds(self, x0):
        beq = np.zeros(self.neq)
        beq[:n] = A @ x0
        return np.concatenate([beq, self.lo_in]), np.concatenate([beq, self.hi_in])

    def u0(self, z):
        return z[self.N * n]

    def plan_u(self, z):
        return z[self.N * n:]

    def shift(self, z, y):
        """The previous plan one step later: drop the first stage, repeat the last input, roll the model."""
        N = self.N
        X = z[:N * n].reshape(N, n)
        U = z[N * n:].reshape(N, m)
        xl = A @ X[-1] + B @ U[-1]
        Xs = np.vstack([X[1:], xl])
        Us = np.vstack([U[1:], U[-1:]])
        zs = np.concatenate([Xs.ravel(), Us.ravel()])
        ye = y[:N * n].reshape(N, n)
        yx = y[N * n:N * n + N * n].reshape(N, n)
        yu = y[2 * N * n:].reshape(N, m)
        ys = np.concatenate([np.vstack([ye[1:], ye[-1:]]).ravel(), np.vstack([yx[1:], yx[-1:]]).ravel(), np.vstack([yu[1:], yu[-1:]]).ravel()])
        return zs, ys


class Condensed:
    """Variables U only: X = Phi x0 + Gamma U substituted; dense H and dense state-constraint rows."""

    def __init__(self, N: int):
        self.N = N
        Phi = np.vstack([np.linalg.matrix_power(A, k + 1) for k in range(N)])
        Gam = np.zeros((N * n, N * m))
        for k in range(N):
            for j in range(k + 1):
                Gam[k * n:(k + 1) * n, j * m:(j + 1) * m] = np.linalg.matrix_power(A, k - j) @ B
        Qbar = sp.block_diag([Q] * (N - 1) + [P]).toarray()
        Rbar = np.kron(np.eye(N), R)
        H = 2 * (Gam.T @ Qbar @ Gam + Rbar)
        self.Phi, self.Gam = Phi, Gam
        self.F = 2 * Gam.T @ Qbar
        self.Xref = np.tile(XREF, N)
        self.P = sp.csc_matrix(np.triu(H))
        self.Hfull = H
        rows_p = Gam[0::n]          # p_k rows
        rows_v = Gam[1::n]          # v_k rows
        self.A = sp.vstack([sp.eye(N), sp.csc_matrix(rows_p), sp.csc_matrix(rows_v)], format="csc")
        self.nz = N * m
        self.Phi_p, self.Phi_v = Phi[0::n], Phi[1::n]

    def q_of(self, x0):
        return self.F @ (self.Phi @ x0 - self.Xref)

    def bounds(self, x0):
        N = self.N
        p_free = self.Phi_p @ x0
        v_free = self.Phi_v @ x0
        lo = np.concatenate([-A_MAX * np.ones(N), -np.inf * np.ones(N), -V_MAX - v_free])
        hi = np.concatenate([A_MAX * np.ones(N), WALL - p_free, V_MAX - v_free])
        return lo, hi

    def u0(self, z):
        return z[0]

    def plan_u(self, z):
        return z

    def shift(self, z, y):
        N = self.N
        zs = np.concatenate([z[1:], z[-1:]])
        parts = [y[i * N:(i + 1) * N] for i in range(3)]
        ys = np.concatenate([np.concatenate([p[1:], p[-1:]]) for p in parts])
        return zs, ys


def step(x, a):
    return A @ x + (B * a).ravel()


# ----------------------------------------------------------------------------- closed loops
def run_osqp(form, mode: str, max_iter: int = 4000, fallback: str = "iterate", record_plans=False):
    """One closed loop with OSQP. mode: 'cold' | 'warm' (previous solution) | 'shift' (shifted previous plan)."""
    s = osqp.OSQP()
    st = dict(OSQP_SET, warm_starting=(mode != "cold"), max_iter=max_iter)
    lo, hi = form.bounds(X0)
    q = form.q_of(X0) if isinstance(form, Condensed) else form.q
    s.setup(P=form.P, q=q, A=form.A, l=lo, u=hi, **st)
    x = X0.copy()
    times, iters, statuses, us, xs = [], [], [], [], [x.copy()]
    prev = None  # (z, y) of the previous solve
    last_plan = None  # inputs of the last converged plan, and the sample it was made at
    for k in range(STEPS):
        lo, hi = form.bounds(x)
        if isinstance(form, Condensed):
            s.update(q=form.q_of(x), l=lo, u=hi)
        else:
            s.update(l=lo, u=hi)
        if mode == "shift" and prev is not None:
            zs, ys = form.shift(*prev)
            s.warm_start(x=zs, y=ys)
        t0 = time.perf_counter()
        r = s.solve()
        dt = time.perf_counter() - t0
        ok = r.info.status_val == 1  # solved
        z = r.x
        if ok:
            a = float(form.u0(z))
            last_plan = (form.plan_u(z).copy(), k)
        elif fallback == "shifted" and last_plan is not None and k - last_plan[1] < form.N:
            a = float(last_plan[0][k - last_plan[1]])
        else:
            a = float(form.u0(z)) if np.all(np.isfinite(z)) else 0.0
        a = float(np.clip(a, -A_MAX, A_MAX))   # the actuator saturates anyway
        prev = (z.copy(), r.y.copy())
        times.append(dt)
        iters.append(int(r.info.iter))
        statuses.append(r.info.status)
        us.append(a)
        x = step(x, a)
        xs.append(x.copy())
    return dict(times=times, iters=iters, statuses=statuses, u=us, x=[list(v) for v in xs])


def run_clarabel(form):
    """One closed loop with Clarabel (interior point). Equalities -> zero cone, two-sided rows -> two nonnegative rows."""
    lo, hi = form.bounds(X0)
    if isinstance(form, Sparse):
        neq = form.neq
        Aeq = form.A[:neq]
        Ain = form.A[neq:]
    else:
        neq = 0
        Aeq = None
        Ain = form.A
    fin_hi = np.isfinite(hi[neq:])
    fin_lo = np.isfinite(lo[neq:])
    blocks = []
    if neq:
        blocks.append(Aeq)
    blocks += [Ain[fin_hi], -Ain[fin_lo]]
    Acl = sp.vstack(blocks, format="csc")

    def b_of(x0):
        lo, hi = form.bounds(x0)
        parts = []
        if neq:
            parts.append(hi[:neq])
        parts += [hi[neq:][fin_hi], -lo[neq:][fin_lo]]
        return np.concatenate(parts)

    cones = ([clarabel.ZeroConeT(neq)] if neq else []) + [clarabel.NonnegativeConeT(int(fin_hi.sum() + fin_lo.sum()))]
    settings = clarabel.DefaultSettings()
    settings.verbose = False
    settings.presolve_enable = False   # keep the structure fixed so update() is allowed
    q0 = form.q_of(X0) if isinstance(form, Condensed) else form.q
    solver = clarabel.DefaultSolver(form.P, q0, Acl, b_of(X0), cones, settings)
    x = X0.copy()
    times, iters, statuses, us, xs = [], [], [], [], [x.copy()]
    for k in range(STEPS):
        if isinstance(form, Condensed):
            solver.update(q=form.q_of(x), b=b_of(x))
        else:
            solver.update(b=b_of(x))
        t0 = time.perf_counter()
        sol = solver.solve()
        dt = time.perf_counter() - t0
        a = float(np.clip(form.u0(np.array(sol.x)), -A_MAX, A_MAX))
        times.append(dt)
        iters.append(int(sol.iterations))
        statuses.append(str(sol.status))
        us.append(a)
        x = step(x, a)
        xs.append(x.copy())
    return dict(times=times, iters=iters, statuses=statuses, u=us, x=[list(v) for v in xs])


def stats_over_repeats(fn, repeats: int):
    """Median per sample over repeats; then, over samples 1..89 (sample 0 has no previous plan, so it
    is always a cold start), the median, the 90th percentile and the max (seconds); sample 0 separately."""
    runs = [fn() for _ in range(repeats)]
    T = np.median(np.array([r["times"] for r in runs]), axis=0)
    first = runs[0]
    Tk = T[1:]
    return dict(median=float(np.median(Tk)), p90=float(np.percentile(Tk, 90)), max=float(Tk.max()), first=float(T[0]),
                iters_median=float(np.median(first["iters"][1:])), iters_max=int(max(first["iters"][1:])), iters_first=int(first["iters"][0]),
                all_solved=all(s in ("solved", "Solved") for s in first["statuses"]))


def closed_loop_cost(xs, us):
    J = 0.0
    for x, a in zip(xs[:-1], us):
        J += (x[0] - WALL) ** 2 + 0.1 * a * a
    return J


def main():
    out_dir = Path(__file__).resolve().parent
    machine = {
        "cpu": subprocess.run(["sysctl", "-n", "machdep.cpu.brand_string"], capture_output=True, text=True).stdout.strip(),
        "cores": subprocess.run(["sysctl", "-n", "hw.ncpu"], capture_output=True, text=True).stdout.strip(),
        "memory_gb": round(int(subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True).stdout.strip()) / 2**30),
        "os": f"macOS {platform.mac_ver()[0]}",
        "python": platform.python_version(),
        "numpy": np.__version__, "scipy": scipy.__version__,
        "osqp": osqp.__version__, "clarabel": clarabel.__version__,
        "date": time.strftime("%Y-%m-%d"),
    }
    print(machine, file=sys.stderr)
    Ns = [20, 30, 40, 60, 80, 120, 160, 240, 320]   # N < 20 cannot stop in time: the docking QP becomes infeasible
    repeats = 5
    timing = {}
    for N in Ns:
        sf, cf = Sparse(N), Condensed(N)
        row = {}
        row["osqp_sparse_cold"] = stats_over_repeats(lambda: run_osqp(sf, "cold"), repeats)
        row["osqp_sparse_shift"] = stats_over_repeats(lambda: run_osqp(sf, "shift"), repeats)
        row["osqp_condensed_cold"] = stats_over_repeats(lambda: run_osqp(cf, "cold"), repeats)
        row["osqp_condensed_shift"] = stats_over_repeats(lambda: run_osqp(cf, "shift"), repeats)
        row["clarabel_sparse"] = stats_over_repeats(lambda: run_clarabel(sf), repeats)
        # the condensed interior-point runs take seconds per closed loop beyond N = 160 (dense KKT): skipped there
        row["clarabel_condensed"] = stats_over_repeats(lambda: run_clarabel(cf), repeats) if N <= 160 else None
        row["sizes"] = dict(sparse_vars=sf.nz, sparse_rows=int(sf.A.shape[0]), sparse_nnz=int(sf.A.nnz + sf.P.nnz),
                            condensed_vars=cf.nz, condensed_rows=int(cf.A.shape[0]), condensed_nnz=int(cf.A.nnz + cf.P.nnz))
        timing[N] = row
        print(N, {k: (round(v["median"] * 1e6), round(v["max"] * 1e6), v["iters_median"]) for k, v in row.items() if k != "sizes" and v}, file=sys.stderr)

    # iterations per sample over one closed loop, N = 20
    N = 20
    sf = Sparse(N)
    per_sample = {
        "osqp_cold": run_osqp(sf, "cold")["iters"],
        "osqp_warm": run_osqp(sf, "warm")["iters"],
        "osqp_shift": run_osqp(sf, "shift")["iters"],
        "clarabel": run_clarabel(sf)["iters"],
    }
    per_sample["time_us"] = {name: [round(t * 1e6, 1) for t in np.median(np.array([fn()["times"] for _ in range(repeats)]), axis=0)]
                             for name, fn in [("osqp_cold", lambda: run_osqp(sf, "cold")), ("osqp_shift", lambda: run_osqp(sf, "shift")),
                                              ("clarabel", lambda: run_clarabel(sf))]}
    exact = run_osqp(sf, "shift")
    per_sample["u"] = exact["u"]
    per_sample["x"] = exact["x"]

    # early termination: k iterations per sample, warm (shifted) vs cold; two fallbacks
    ref = run_clarabel(sf)
    J_ref = closed_loop_cost(ref["x"], ref["u"])
    early = []
    for k_max in [5, 10, 20, 40, 80]:
        for mode in ["cold", "shift"]:
            for fb in ["iterate", "shifted"]:
                r = run_osqp(sf, mode, max_iter=k_max, fallback=fb)
                xs = np.array(r["x"])
                early.append(dict(k=k_max, mode=mode, fallback=fb,
                                  converged=sum(s == "solved" for s in r["statuses"]),
                                  max_p=float(xs[:, 0].max()), max_v=float(np.abs(xs[:, 1]).max()),
                                  cost_ratio=closed_loop_cost(r["x"], r["u"]) / J_ref,
                                  final_p=float(xs[-1, 0]), final_v=float(xs[-1, 1])))
                e = early[-1]
                print("early", k_max, mode, fb, e["converged"], round(e["max_p"], 4), round(e["max_v"], 4), round(e["cost_ratio"], 4), file=sys.stderr)

    out = dict(machine=machine, settings=dict(osqp=OSQP_SET, clarabel="defaults, presolve off", repeats=repeats, steps=STEPS),
               timing={str(k): v for k, v in timing.items()}, per_sample=per_sample, early=early, J_ref=J_ref)
    (out_dir / "bench.json").write_text(json.dumps(out, indent=1))
    print("wrote", out_dir / "bench.json", file=sys.stderr)


if __name__ == "__main__":
    main()
