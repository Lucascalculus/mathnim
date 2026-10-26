import numpy as np
import cvxpy as cp

dt, N = 0.1, 20
A = np.array([[1, dt], [0, 1]]); B = np.array([[dt**2 / 2], [dt]])
Q = np.diag([1.0, 0.0]); R = np.array([[0.1]]); x_ref = np.array([9.5, 0.0])

# predictions X = Phi x0 + Gamma U  (M2)
Phi = np.vstack([np.linalg.matrix_power(A, k) for k in range(1, N + 1)])
Gamma = np.zeros((2 * N, N))
for k in range(N):
    for j in range(k + 1):
        Gamma[2*k:2*k+2, j] = (np.linalg.matrix_power(A, k - j) @ B)[:, 0]

# the limits as rows of  G U <= w + E x0
Cp = np.kron(np.eye(N), [[1, 0]]); Cv = np.kron(np.eye(N), [[0, 1]])
G = np.vstack([np.eye(N), -np.eye(N), Cv @ Gamma, -Cv @ Gamma, Cp @ Gamma])
w = np.concatenate([np.ones(N), np.ones(N), 2 * np.ones(N), 2 * np.ones(N), 10 * np.ones(N)])
E = np.vstack([np.zeros((2 * N, 2)), -Cv @ Phi, Cv @ Phi, -Cp @ Phi])
print(G.shape)

# the cost (M3), as a function of U
Qb = np.kron(np.eye(N), Q); Rb = np.kron(np.eye(N), R)
H = 2 * (Gamma.T @ Qb @ Gamma + Rb)
def F_of(x0):
    return 2 * Gamma.T @ Qb @ (Phi @ x0 - np.tile(x_ref, N))

def solve(x0):
    U = cp.Variable(N)
    cons = [G @ U <= w + E @ x0]
    prob = cp.Problem(cp.Minimize(0.5 * cp.quad_form(U, cp.psd_wrap(H)) + F_of(x0) @ U), cons)
    prob.solve()
    lam = cons[0].dual_value
    return U.value, lam

def J(U, x0):
    X = (Phi @ x0 + Gamma @ U).reshape(N, 2)
    return sum((X[:, 0] - x_ref[0])**2) + (x0[0] - x_ref[0])**2 + 0.1 * U @ U

x0 = np.array([7.0, 0.0])
U_free = -np.linalg.solve(H, F_of(x0))
U_clip = np.clip(U_free, -1, 1)
U_best, lam = solve(x0)
np.set_printoptions(precision=2, suppress=True)
print('free', U_free[[0, 9, 19]])
print('clip', U_clip[[0, 9, 19]])
print('best', U_best[[0, 9, 19]])
print('J clip', J(U_clip, x0), 'J best', J(U_best, x0))
print('active rows', np.flatnonzero(lam > 1e-6), lam[lam > 1e-6])
Xc = (Phi @ x0 + Gamma @ U_clip).reshape(N, 2); Xb = (Phi @ x0 + Gamma @ U_best).reshape(N, 2)
print('clip max p,v', Xc[:,0].max(), Xc[:,1].max(), 'best', Xb[:,0].max(), Xb[:,1].max())
for x0 in [np.array([6.0, 1.5]), np.array([7.1, 1.9])]:
    U_free = -np.linalg.solve(H, F_of(x0)); U_clip = np.clip(U_free, -1, 1); U_best, lam = solve(x0)
    Xc = (Phi @ x0 + Gamma @ U_clip).reshape(N, 2)
    print(x0, 'clip u0', U_clip[0], 'best u0', U_best[0], 'clip max p', Xc[:,0].max(), 'max v', Xc[:,1].max(), 'viol', (G @ U_clip - w - E @ x0).max())
