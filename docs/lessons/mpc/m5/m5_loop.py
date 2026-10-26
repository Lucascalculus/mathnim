import time
import numpy as np
import cvxpy as cp

dt, N = 0.1, 20
A = np.array([[1, dt], [0, 1]]); B = np.array([[dt**2 / 2], [dt]])
x_ref = np.array([10.0, 0.0]); MARGIN = 1e-3            # 1 mm back-off from the wall (see the notes)

x0 = cp.Parameter(2)                                    # the only thing that changes per sample
X, U = cp.Variable((2, N + 1)), cp.Variable((1, N))
cost, cons = 0, [X[:, 0] == x0]
for k in range(N):
    cost += cp.square(X[0, k] - x_ref[0]) + 0.1 * cp.square(U[0, k])
    cons += [X[:, k + 1] == A @ X[:, k] + B @ U[:, k],  # sparse form: states stay variables
             cp.abs(U[0, k]) <= 1, cp.abs(X[1, k + 1]) <= 2, X[0, k + 1] <= 10 - MARGIN]
cost += cp.square(X[0, N] - x_ref[0])
prob = cp.Problem(cp.Minimize(cost), cons)              # compiled once (DPP), reused every sample

OSQP = dict(solver=cp.OSQP, warm_start=True, eps_abs=1e-4, eps_rel=1e-4,
            max_iter=4000, time_limit=0.02)             # 20 ms of the 100 ms sample
x, plan, worst, fallbacks, max_p = np.zeros(2), None, 0.0, 0, 0.0
for k in range(90):
    x0.value = x
    t0 = time.perf_counter()
    prob.solve(**OSQP)
    worst = max(worst, time.perf_counter() - t0) if k else 0.0   # sample 0 also compiles
    if prob.status in ("optimal", "optimal_inaccurate"):
        plan = U.value[0].copy()                        # keep the whole plan, not just a
        a = plan[0]
    elif plan is not None and len(plan) > 1:            # not solved in time: fall back
        plan = plan[1:]                                 # on the previous plan, shifted
        a, fallbacks = plan[0], fallbacks + 1
    else:
        a = -1.0                                        # nothing usable: brake
    a = float(np.clip(a, -1, 1))
    x = A @ x + B[:, 0] * a
    max_p = max(max_p, x[0])
print(f"end p = {x[0]:.4f} m, v = {x[1]:.4f} m/s; closest to the wall {max_p:.4f} m; "
      f"fallbacks {fallbacks}; worst solve {1e3 * worst:.0f} ms")
