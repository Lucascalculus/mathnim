import numpy as np
import cvxpy as cp

dt, N = 0.1, 5                              # a short look-ahead: 0.5 s
A = np.array([[1, dt], [0, 1]])
B = np.array([[dt**2 / 2], [dt]])
a_max, v_max, wall = 1.0, 2.0, 10.0
c = v_max / a_max - dt / 2                  # 1.95 s: edge of the terminal set

x0 = cp.Parameter(2)                        # the measured state, set every sample
X = cp.Variable((2, N + 1))
U = cp.Variable((1, N))
s = cp.Variable(N, nonneg=True)             # slack on the speed limit
cost = (cp.sum_squares(X[0, 1:] - wall) + 0.1 * cp.sum_squares(U)
        + 1000 * cp.sum(s) + cp.sum_squares(s))      # l1 = 1000, l2 = 1
limits = [X[:, 0] == x0,
          X[:, 1:] == A @ X[:, :-1] + B @ U,
          cp.abs(U) <= a_max,
          X[1, 1:] <= v_max + s,            # soft: may be broken, at a price
          X[1, 1:] >= -v_max,
          X[0, 1:] <= wall,                 # hard: the wall is not negotiable
          X[0, N] + c * X[1, N] <= wall]    # terminal set: still able to stop
problem = cp.Problem(cp.Minimize(cost), limits)

x = np.array([0.0, 0.0])
v_top = slack_top = 0.0
for k in range(200):
    x0.value = x
    problem.solve()
    if problem.status != cp.OPTIMAL:        # X_f and the soft limit keep this from happening
        raise RuntimeError(f"no plan at t = {k * dt:.1f} s")
    a = U.value[0, 0]
    slack_top = max(slack_top, s.value.max())
    x = A @ x + B[:, 0] * a
    if k + 1 == 30:
        x[1] += 0.4                         # a gust at t = 3 s
    v_top = max(v_top, x[1])
    if abs(x[0] - wall) < 5e-3 and abs(x[1]) < 5e-3:
        print(f"docked at t = {(k + 1) * dt:.1f} s")
        break
print(f"top speed {v_top:.2f} m/s, largest slack {slack_top:.2f}")
# docked at t = 12.0 s
# top speed 2.40 m/s, largest slack 0.30
