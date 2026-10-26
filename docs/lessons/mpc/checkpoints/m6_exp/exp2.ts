import { cart_step, double_integrator, make_mpc, dlqr, type Vec } from '/Users/lucas/Documents/Mathnim/packages/visuals/src/mpc/math';
const { A, B } = double_integrator(0.1);
const Q = [[1, 0], [0, 0]], R = [[0.1]];
const L = dlqr(A, B, Q, R);
function run(N: number, o: any, steps = 300) {
  const t0 = Date.now();
  const mpc = make_mpc({ A, B, Q, R, N, P: o.P, u_min: [-1], u_max: [1], x_min: [null, -2], x_max: [10, 2], terminal: o.terminal });
  let x: Vec = [0, 0]; let inf = -1, crash = -1, imp = 0, docked = -1; const J: number[] = [];
  for (let k = 0; k < steps; k++) {
    const pl = mpc.solve(x, { x_ref: [10, 0] });
    let a: number;
    if (pl.status !== 'optimal') { if (inf < 0) inf = k; a = -1; J.push(NaN); if (k === 0) break; } else { a = pl.U[0][0]; J.push(pl.cost); }
    const s = cart_step(x, a, { wall: 10 + 1e-9 });
    if (s.crashed && s.impact > 1e-3) { crash = k + 1; imp = s.impact; break; }
    x = s.x;
    if (Math.abs(x[0] - 10) < 5e-3 && Math.abs(x[1]) < 5e-3) { docked = k + 1; break; }
  }
  let mono = true; for (let i = 1; i < J.length; i++) if (J[i] > J[i - 1] + 1e-9) { mono = false; }
  let firstInc = -1; for (let i = 1; i < J.length; i++) if (J[i] > J[i - 1] + 1e-9) { firstInc = i; break; }
  return `inf ${inf} crash ${crash} imp ${imp.toFixed(2)} docked ${docked} mono ${mono} firstInc ${firstInc} ms ${Date.now() - t0}`;
}
const brake = { G: [[1, 1.95]], w: [10] };
const eq = { G: [[1, 0], [-1, 0], [0, 1], [0, -1]], w: [10, -10, 0, 0] };
for (const N of [2, 3, 5, 8]) { console.log(N, 'none', run(N, {})); console.log(N, 'P', run(N, { P: L.P })); console.log(N, 'Xf', run(N, { terminal: brake })); console.log(N, 'XfP', run(N, { terminal: brake, P: L.P })); }
for (const N of [19, 20]) console.log(N, 'none', run(N, {}));
for (const N of [60, 65, 68, 69, 70, 71, 72, 75, 80]) console.log(N, 'eq', run(N, { terminal: eq }));
