import numpy as np
import casadi as ca

# ---- the car: kinematic bicycle, x = (X, Y, psi, v), u = (a, delta)
dt, N, lf, lr = 0.1, 20, 1.4, 1.4
def f(x, u):
    beta = ca.atan(lr / (lf + lr) * ca.tan(u[1]))
    return ca.vertcat(x[3] * ca.cos(x[2] + beta), x[3] * ca.sin(x[2] + beta),
                      x[3] / lr * ca.sin(beta), u[0])
def F(x, u):                                   # one RK4 step, input held for dt
    k1 = f(x, u); k2 = f(x + dt / 2 * k1, u); k3 = f(x + dt / 2 * k2, u); k4 = f(x + dt * k3, u)
    return x + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)

# ---- the S road: straight 12, left R9 90 deg, straight 4, right R9 90 deg, straight 30
ds, pts, x, y, h = 0.05, [(0.0, 0.0, 0.0)], 0.0, 0.0, 0.0
for L, kap in [(12, 0), (9 * np.pi / 2, 1 / 9), (4, 0), (9 * np.pi / 2, -1 / 9), (30, 0)]:
    for _ in range(int(round(L / ds))):
        h += kap * ds / 2; x += ds * np.cos(h); y += ds * np.sin(h); h += kap * ds / 2
        pts.append((x, y, h))
road = np.array(pts)                           # one row every 5 cm: X, Y, heading
def road_at(s):
    return road[min(int(round(s / ds)), len(road) - 1)]

# ---- the NMPC, multiple shooting: states and inputs are both decision variables
opti = ca.Opti()
X, U = opti.variable(4, N + 1), opti.variable(2, N)
x0, ref, u_prev = opti.parameter(4), opti.parameter(4, N), opti.parameter(2)
J = 0
for k in range(N):
    e = X[:, k + 1] - ref[:, k]
    J += (3 if k == N - 1 else 1) * (e[0]**2 + e[1]**2 + e[2]**2 + 0.2 * e[3]**2)
    du = U[:, k] - (U[:, k - 1] if k else u_prev)
    J += 0.05 * U[0, k]**2 + U[1, k]**2 + 0.1 * du[0]**2 + 20 * du[1]**2
    opti.subject_to(X[:, k + 1] == F(X[:, k], U[:, k]))      # the gaps must close
opti.subject_to(X[:, 0] == x0)
opti.subject_to(opti.bounded(-4, U[0, :], 2))                # braking / accelerating
opti.subject_to(opti.bounded(-0.5, U[1, :], 0.5))            # steering, about 29 deg
opti.minimize(J)
opti.solver('ipopt', {'print_time': False}, {'print_level': 0, 'sb': 'yes'})

# ---- the closed loop: 8 s, warm-started with the last solution shifted
x, s, u, errs, iters = np.array([0.0, 0.0, 0.0, 6.0]), 0.0, np.zeros(2), [], []
Xg, Ug = np.tile(x[:, None], (1, N + 1)), np.zeros((2, N))
for step in range(80):
    R = np.array([[*road_at(s + 6 * dt * (k + 1)), 6.0] for k in range(N)]).T
    opti.set_value(x0, x); opti.set_value(ref, R)
    opti.set_value(u_prev, u)
    opti.set_initial(X, Xg); opti.set_initial(U, Ug)
    sol = opti.solve()
    Xs, Us = sol.value(X), sol.value(U)
    iters.append(sol.stats()['iter_count'])
    u = Us[:, 0]                                              # apply the first input only
    x = np.array(F(x, u)).ravel()                             # the car moves (same model)
    Xg = np.hstack([Xs[:, 1:], Xs[:, -1:]]); Ug = np.hstack([Us[:, 1:], Us[:, -1:]])
    i0 = int(s / ds); w = road[max(0, i0 - 60): i0 + 240]     # nearest road point ahead
    j = np.argmin((w[:, 0] - x[0])**2 + (w[:, 1] - x[1])**2); s = (max(0, i0 - 60) + j) * ds
    n = np.array([-np.sin(w[j, 2]), np.cos(w[j, 2])])
    errs.append(n @ (x[:2] - w[j, :2]))
print(f'largest |e| = {100 * max(map(abs, errs)):.1f} cm, '
      f'Ipopt iterations per sample: {min(iters)} to {max(iters)}')
