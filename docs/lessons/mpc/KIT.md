# MPC course kit (`packages/visuals/src/mpc/`)

Built by agent M-A for every MPC lesson. Two modules plus one story module:

| File | What | Import |
|---|---|---|
| `math.ts` | pure math: linear algebra, the cart model, ZOH discretization, Φ/Γ, condensed QP, LQR, a dense QP solver, linear MPC, closed-loop simulation | `import { … } from './math'` |
| `kit.ts` | drawing: `Plot`, `Track` (cart + wall), `HorizonStrip`, `StepSlider`, polylines (solid / dashed / clipped), fills, hatching, words, language helpers | `import { … } from './kit'` |
| `dock.ts` | M1's docking story (cached runs): `dock_run(N)`, `pd_run(kp, kd)` | `import { … } from './dock'` |

Unit tests: `packages/visuals/src/mpc/math.test.ts` (25 tests: closed forms,
scipy's DARE values, brute-force active-set enumeration, KKT residuals).
Run `npx vitest run src/mpc` in `packages/visuals`. Put your own tests next to
your files (`src/mpc/<yours>.test.ts`); the vitest config already includes them.

**Registering visuals.** Every MPC visual lives in its own file in
`packages/visuals/src/mpc/` and is registered in `packages/visuals/src/mpc/index.ts`
(owned by M-A). Send M-A (or the main session) the export name and file; do not
edit `index.ts` yourself. The visuals checker already loads `src/mpc/index.ts`:
`npm run check -w @mathnim/visuals -- --only <name>` once it is registered.
Send the name as soon as the file exists (it may be unfinished); M-A registers it
at once so you can run the checker on it.

## Conventions (same as README "Shared conventions")

- `x_{k+1} = A x_k + B u_k`; `x ∈ R^n`, `u ∈ R^m`; horizon `N`.
- `J = Σ_{k=0}^{N-1} (x_kᵀQx_k + u_kᵀRu_k) + x_NᵀPx_N`.
- `U = (u_0..u_{N-1})` stacked (length mN). `X = (x_1..x_N)` stacked (length nN).
  **x_0 is not in X.** `X = Φ x_0 + Γ U`.
- Condensed QP: `min ½ UᵀHU + (F x_0)ᵀU` with `H = 2(ΓᵀQ̄Γ + R̄)`, `F = 2ΓᵀQ̄Φ`,
  `Q̄ = blkdiag(Q,…,Q,P)`, `R̄ = blkdiag(R,…,R)` (so it equals J minus constants).
- Feedback `u = −Kx` (`dlqr` returns `K` and `P`).
- Matrices are row-major `number[][]` (`Mat`), vectors `number[]` (`Vec`).

## The running example: `CART`

```ts
CART = { dt: 0.1, a_max: 1, v_max: 2, p_max: 10 }   // s, m/s², m/s, m (course numbers, not a real vehicle)
double_integrator(dt?)  // exact ZOH: A = [[1, dt], [0, 1]], B = [[dt²/2], [dt]]
cart_step(x, a, { dt?, wall?, d? })  // one sample; stops at the wall: { x, crashed, impact }; d = constant disturbance [m/s²] (M7 slope)
stopping_distance(v, a?)             // v²/(2a)
```

State `x = [p, v]`, input `u = [a]`. Position `p` is the cart's **front bumper**
(so `p = p_max` means touching the wall; the `Track` draws it that way).
M1 uses: start at rest at p = 0, dock against the wall at p = 10.
Key fact used in M1 (tested): braking from 2 m/s at 1 m/s² takes 2 s = 20 steps
and 2 m, and the docking MPC needs a look-ahead of about that.

## math.ts API

**Linear algebra** (small, dense): `zeros, eye, copy, transpose, matmul, matvec,
add, sub, scale, vadd, vsub, vscale, dot, norm, max_abs, diag, blkdiag, vstack,
hstack, mat_pow, solve(A, b | B), inv, cholesky (null if not PD), inv_spd, sym,
expm, eigvals (complex pairs [re, im], n ≤ 6), spectral_radius`.

**Models**
- `c2d(Ac, Bc, dt)`: exact zero-order hold via `expm([[Ac, Bc], [0, 0]] dt)`.
- `euler(Ac, Bc, dt)`: forward Euler (for comparison; misses dt²/2).
- `DOUBLE_INTEGRATOR_C = { A: [[0,1],[0,0]], B: [[0],[1]] }`.
- `step(A, B, x, u)`, `rollout(A, B, x0, U: Vec[]) → x_0..x_N`, `stack`, `unstack(z, n)`.

**Prediction and cost**
- `prediction_matrices(A, B, N) → { Phi, Gamma }`.
- `condense(A, B, Q, R, P, N) → { n, m, N, Phi, Gamma, Qbar, Rbar, H, F }`.
- `horizon_cost(A, B, Q, R, P, x0, U)`: J by direct simulation.
- `unconstrained_gain(cond)`: first m rows of `H⁻¹F` (u_0 = −K x_0).

**LQR**
- `dlqr(A, B, Q, R) → { K, P, iterations, converged }` (Riccati iteration from P = Q; matches scipy to 1e-8).
- `riccati_finite(A, B, Q, R, P_N, N) → { K: K_0..K_{N-1}, P: P_0..P_N }` (K_0 equals `unconstrained_gain`).

**QP solver**

```ts
solve_qp({ H, f, A?, b?, Aeq?, beq?, lb?, ub? }, { Hinv?, tol?, max_iter? }) → {
  x, status: 'optimal' | 'infeasible' | 'max_iter', obj,
  lambda /* rows of A */, nu /* rows of Aeq */, mu_lb, mu_ub,
  active /* active rows of A */, active_lb, active_ub, iterations }
kkt_residual(qp, result) → { stationarity, primal, dual, complementarity }
```

- Problem: `min ½xᵀHx + fᵀx s.t. Ax ≤ b, Aeq x = beq, lb ≤ x ≤ ub`. **H must be
  positive definite** (true for MPC with R ≻ 0; for a QP picture, use an SPD H).
- KKT sign convention: `Hx + f + Aᵀλ + Aeqᵀν − μ_lb + μ_ub = 0`, `λ, μ ≥ 0`.
- Method: Goldfarb–Idnani dual active set (the quadprog algorithm), with
  Cholesky up/down-dates of the active set. Exact to rounding; finite; reports
  `infeasible` reliably. `±Infinity` bounds are ignored.
- Speed (node, M-series laptop): a horizon-40 cart QP with box inputs and a state
  bound takes about 1 ms; a 90-step closed loop with N = 40 about 100 ms. Cache
  closed-loop runs (see `dock.ts`) rather than re-solving on every frame.

**Linear MPC**

```ts
const mpc = make_mpc({
  A, B, Q, R, N,
  P?,                         // terminal weight (default Q); dlqr(...).P for the LQR cost-to-go
  u_min?, u_max?,             // per input
  du_max?,                    // per input: |u_k − u_{k−1}| ≤ du_max (u_{−1} = solve()'s u_prev)
  x_min?, x_max?,             // per state (null = none), on x_1..x_N
  terminal?: { G, w },        // x_N ∈ {x : G x ≤ w}
  soft?: { l1, l2 },          // soften state + terminal rows: slack s ≥ 0, cost l1·s + l2·s²
});
const plan = mpc.solve(x0, { x_ref?, u_ref?, u_prev? });
// plan: { status, U: Vec[] (N), X: Vec[] (x_0..x_N), cost, slack, n_active, saturated: k[], iterations }
// mpc.cond (the Condensed matrices), mpc.H, mpc.Hinv, mpc.P
```

- `x_ref`/`u_ref` are constant references; the cost uses `x − x_ref`, `u − u_ref`.
- Hard state constraints can make the QP **infeasible** (`plan.status`). With
  `soft`, it stays feasible; `plan.slack` tells how much a constraint was broken.
  With `l1` large (≥ 1e3 on the cart) the soft solution equals the hard one
  whenever the hard one exists (tested).

**Closed loop**

```ts
simulate({ x0, steps, control: (x, k, u_prev) => ({ u, plan?, status? }), plant: (x, u, k) => x⁺, dt?, stop?: (x, k) => boolean })
  → { t, x: x_0..x_T, u, plans, status, stopped_at }
receding_horizon(mpc, { x0, steps, plant?, solve?: (x, k, u_prev) => SolveOptions, fallback?: (x, u_prev, last_plan) => u, stop?, dt? })
  // applies plan.U[0] each step; on infeasible QPs uses fallback (default: the previous plan, shifted)
clip(u, lo?, hi?)
steady_target(A, B, C, r, { Bd?, d? }) → { x, u }   // [[I − A, −B], [C, 0]] [x; u] = [Bd d; r] (M7)
```

## dock.ts (M1's story; reuse it if you show the same scene)

- `dock_run(N, { a_max?, v_max?, wall?, r?, steps? }) → DockRun` (cached):
  MPC with `Q = diag(1, 0)`, `R = r` (0.1), hard `|a| ≤ a_max`, `|v| ≤ v_max`,
  `p ≤ wall`, target `p = wall`; full braking when the QP is infeasible.
  `DockRun = { x, u, plans, infeasible_k, brake_k, crash_k, impact, docked_k }`
  (padded with the final state up to `steps`, default 90).
- `pd_run(kp, kd, opts)`: the reactive PD controller on the same task.
- Results (tested): with a_max = 1, look-ahead 1.5 s (N = 15) hits the wall at
  0.54 m/s, 2.0 s (N = 20) docks; with a_max = 0.8, 2.0 s hits at 0.45 m/s and
  2.5 s docks. N = 5 hits at 1.55 m/s. **M6 (M-B):** this is the "short horizon
  hits the wall" behaviour; please reuse `dock_run` for consistency, and make M6
  about *why* (recursive feasibility, terminal set / cost), not *that*.

## kit.ts API (drawing)

Everything takes colours from `palette()` at build time; live parts are
updaters with cached keys; state belongs in `ValueTracker`s you register with
`this.track(...)`. Re-exports: `LANG_SPEC, pick, resolve_lang, ft_lang, Lang`
(language), `label, fit` (sans words), `tex, texs, backed` (TeX),
`Choice, listen, emit, live_label, txt` (from the fine-tuning part C kit:
a segmented control, scene events for worlds, live text).

**Plot** (a panel of axes; data coordinates in, scene coordinates out)

```ts
const plot = new Plot({
  box: { x0, x1, y0, y1 },            // the data area on screen
  x: [0, 8], y: [0, 11.5],            // data ranges
  x_ticks?, y_ticks?, x_fmt?, y_fmt?,
  x_label?: 'words' | { tex: 't\\;(\\mathrm{s})' }, y_label?,
  grid?: true, zero_axis?: false, font?: 22,
});
this.add(plot.group);                                   // axes, ticks, titles
plot.band(10, 11.5, c.coral, 0.14)                      // shaded constraint band (y between two values)
plot.vband(() => t0, () => t0 + N * dt)                 // vertical band, live (e.g. the horizon window)
plot.region(pts, 'above' | 'below', color, opacity)     // shade above/below a curve (e.g. "too fast to stop")
plot.hline(y, color, { dash }) / plot.vline(x, …)       // reference lines (dashed by default)
plot.curve(pts, { color, width, dash?: true | [d, g] }) // static, clipped to the box
plot.live_curve(() => pts, style, key?)                 // PAST: solid; PREDICTED: { dash: true }
plot.stairs(vals, style) / plot.live_stairs(() => vals, style)  // inputs as zero-order-hold stairs
plot.cursor(() => t) / plot.live_dot(() => [x, y] | null) / plot.note('words', x, y, color, size, align)
plot.X(x), plot.Y(y), plot.P(x, y), plot.data(scene_point), plot.pieces(pts)
```

**Track** (the cart on a rail with a wall)

```ts
const track = new Track({ x0: -5.6, x1: 6.0, y: 2.45, p: [0, 10], wall?: 10, target?: 6, tick?: 1, label_every?: 2, cart_w?, cart_h? });
this.add(track.group);                                  // rail, ticks, metre labels, hatched wall, flag
const cart = track.cart(() => p_tracker.get_value(), { color?, opacity?, scale? });  // front bumper at p
const dots = track.ghosts(() => planned_positions);    // the plan's positions as dots on the rail
track.x_of(p), track.p_of(x), track.flag(p, color)
```

**HorizonStrip** (the plan as N cells; the first is applied; the window slides)

```ts
const strip = new HorizonStrip({ x0, y, cell_w, cell_h, N, plan: (k) => U_k /* N numbers */, u_max?: 1, k?: tracker, words?: ['apply', 'planned'] });
this.track(...strip.trackers());
this.play(strip.shift(0.9));    // the window slides one step; the old plan is then shown shifted
this.play(strip.replan(0.7));   // ...and morphs into the newly solved plan
// fast-forward: animate strip.k continuously (blend stays 1)
```

**StepSlider** (a number on a grid, linear or log): `new StepSlider(tracker,
{ lo, hi, step, x0, x1, y, ticks?, log? })`, `slider.group`, `slider.attach(ui,
'label', { on_change, on_end })` (keyboard: arrows = one step).

**Small pieces:** `polyline(pts, color, width, { dash: [d, g] })`,
`poly_points`, `polys_points`, `dash_polys`, `clip_poly(pts, box)`,
`live_vm(vm, () => points, key)`, `stroke(color, width)`, `fill_box`,
`fill_poly`, `hatch(box, color)`, `visible_when(m, cond)`, `at(m, x, y, align)`,
`words(s, size, color, x, y, { max_w, align })`, `key_of(numbers)`, `SAFE`.

**Language.** Every visual takes `lang: LANG_SPEC` and draws words with
`pick(resolve_lang(p.lang), en, zh)`. Lessons pass `ctx.lang` (see the
fine-tuning lessons' `vis()` helper, or `apps/mathnim/src/lessons/mpc/common.ts`
once M-A adds it). Add `lang: 'zh'` examples and look at the Chinese contact
sheets: CJK is wider.

**Honesty, beside the picture.** Every simulated figure says what it is, such as
"simulation of a toy cart: |a| up to 1 m/s², |v| up to 2 m/s" /
"玩具小车的模拟：|a| 不超过 1 m/s²，|v| 不超过 2 m/s", through `aside(this, words(...))`
(`packages/visuals/src/aside.ts`): the words are kept on the scene and the lesson
shows them in a faint line under the figure. No sentences are drawn in a figure
(changed 2026-10-29; see `receding_loop.ts`).

## Visuals by M-A (registered)

| Name | Lesson | What |
|---|---|---|
| `mpc_receding_loop` | M1 scene, **course feature picture** | The docking cart: plan N steps (dashed + strip), apply the first, slide, re-plan; fast-forward. Params: `N` (8–30, default 20), `lang`. Feature image: params `{ N: 20, lang: 'en' }` / `{ N: 20, lang: 'zh' }`, the frame at scene time ≈ 20.5 s (simulated t ≈ 4.4 s): the far end of the plan already brakes for the wall while the applied first step is still "cruise". The final frame (25.8 s, docked) also works. |

(More M1–M3 visuals are listed here as they land.)
