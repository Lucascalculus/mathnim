import numpy as np
import cvxpy as cp

dt, N = 0.1, 20
A = np.array([[1, dt], [0, 1]]); B = np.array([[dt**2 / 2], [dt]])
Q = np.diag([1.0, 0.0]); R = 0.1; x_ref = np.array([9.5, 0.0])

# predictions X = Phi x0 + Gamma U (M2)
Phi = np.vstack([np.linalg.matrix_power(A, k) for k in range(1, N + 1)])
Gamma = np.zeros((2 * N, N))
for k in range(N):
    for j in range(k + 1):
        Gamma[2*k:2*k+2, j] = (np.linalg.matrix_power(A, k - j) @ B)[:, 0]

# the limits as rows of G U <= w + E x0
Cp = np.kron(np.eye(N), [[1, 0]]); Cv = np.kron(np.eye(N), [[0, 1]])
I = np.eye(N); one = np.ones(N)
G = np.vstack([I, -I, Cv @ Gamma, -Cv @ Gamma, Cp @ Gamma])     # (100, 20)
w = np.concatenate([one, one, 2 * one, 2 * one, 10 * one])
E = np.vstack([np.zeros((2 * N, 2)), -Cv @ Phi, Cv @ Phi, -Cp @ Phi])

# the cost (M3): 1/2 U'HU + f'U
Qb = np.kron(np.eye(N), Q)
H = 2 * (Gamma.T @ Qb @ Gamma + R * I)
f = lambda x0: 2 * Gamma.T @ Qb @ (Phi @ x0 - np.tile(x_ref, N))

def best(x0):
    U = cp.Variable(N)
    limits = [G @ U <= w + E @ x0]
    cp.Problem(cp.Minimize(0.5 * cp.quad_form(U, cp.psd_wrap(H)) + f(x0) @ U), limits).solve()
    return U.value, limits[0].dual_value          # the plan and one lambda per row

x0 = np.array([7.0, 0.0])                         # at rest, 2.5 m before the flag
U_free = -np.linalg.solve(H, f(x0))               # M3's plan, no limits
U_clip = np.clip(U_free, -1, 1)                   # what a saturating motor does
U_best, lam = best(x0)
print(U_free[[0, 9, 19]].round(2))   # [ 6.75 -0.85 -0.03]
print(U_clip[[0, 9, 19]].round(2))   # [ 1.   -0.85 -0.03]
print(U_best[[0, 9, 19]].round(2))   # [ 1.    1.    0.03]
print(np.flatnonzero(lam > 1e-6))    # [ 0 ... 14]: u_k <= 1 is active for k = 0..14
J = lambda U: 0.5 * U @ H @ U + f(x0) @ U        # the cost, up to a constant
print(round(J(U_clip) - J(U_best), 2))  # 24.63: the clipped plan costs more
