"""The course's running example, shared by labs L1 and L3.

A cart on a track (a double integrator): state x = (p, v) in m and m/s, input
a in m/s^2, sampled every DT = 0.1 s with a zero-order hold. Limits |a| <= 1,
|v| <= 2, and a wall at p = 10 (p is the cart's front bumper). These are the
course's numbers, chosen for the story, not a real vehicle.
"""
from __future__ import annotations

import numpy as np

DT = 0.1
A_MAX = 1.0
V_MAX = 2.0
WALL = 10.0

# exact zero-order-hold discretisation of p' = v, v' = a
A = np.array([[1.0, DT], [0.0, 1.0]])
B = np.array([[DT**2 / 2], [DT]])
C = np.array([[1.0, 0.0]])  # only the position is measured


def plant_step(x: np.ndarray, a: float, d: float = 0.0, wall: float = WALL) -> tuple[np.ndarray, float]:
    """One sample of the real cart. d is a constant extra acceleration (a slope or
    headwind) that the controller does not know about. If the cart would pass the
    wall it stops there; the second value is the speed it hit the wall with
    (0 when it did not)."""
    acc = a + d
    p = x[0] + x[1] * DT + 0.5 * acc * DT**2
    v = x[1] + acc * DT
    if p <= wall + 1e-9:
        return np.array([p, v]), 0.0
    # the instant tau in (0, DT] at which it reaches the wall: p0 + v0 tau + acc tau^2 / 2 = wall
    qa, qb, qc = 0.5 * acc, x[1], x[0] - wall
    if abs(qa) < 1e-12:
        tau = -qc / qb
    else:
        disc = max(0.0, qb * qb - 4 * qa * qc)
        roots = [(-qb - np.sqrt(disc)) / (2 * qa), (-qb + np.sqrt(disc)) / (2 * qa)]
        tau = min(t for t in roots if -1e-12 <= t <= DT + 1e-12)
    return np.array([wall, 0.0]), max(0.0, x[1] + acc * tau)


def dlqr(A: np.ndarray, B: np.ndarray, Q: np.ndarray, R: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Infinite-horizon LQR: u = -K x, and the cost-to-go matrix P (x' P x)."""
    from scipy.linalg import solve_discrete_are

    P = solve_discrete_are(A, B, Q, R)
    K = np.linalg.solve(R + B.T @ P @ B, B.T @ P @ A)
    return K, P
